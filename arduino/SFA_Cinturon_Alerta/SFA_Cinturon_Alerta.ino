#include <Wire.h>
#include <SoftwareSerial.h>
#include <LiquidCrystal_I2C.h>

/*
  SFA - Sistema de alerta ante caídas
  Arduino UNO + MPU6050 + HC-06 + LCD I2C + buzzer + LEDs

  Protocolo serial compartido:
    BOOT,SFA,1.0
    TEL,ms,estado,ax,ay,az,g,tilt,mov,caidas
    EVT,ms,tipo,detalle
    RSP,comando,resultado

  El Arduino mantiene la alerta local aunque la PC/Bluetooth no respondan.
*/

const byte PIN_BT_RX = 10;       // Arduino recibe desde TXD del HC-06
const byte PIN_BT_TX = 11;       // Arduino transmite hacia RXD del HC-06 con divisor resistivo
const byte PIN_LED_VERDE = 4;
const byte PIN_LED_AMARILLO = 5;
const byte PIN_BUZZER = 6;
const byte PIN_LED_ROJO = 7;

const byte MPU_ADDR = 0x68;
const byte LCD_ADDR = 0x27;

SoftwareSerial bt(PIN_BT_RX, PIN_BT_TX);
LiquidCrystal_I2C lcd(LCD_ADDR, 16, 2);

enum EstadoSistema {
  NORMAL,
  EVENTO_INERCIAL,
  POSIBLE_CAIDA,
  CAIDA_CONFIRMADA,
  ALERTA_SILENCIADA
};

EstadoSistema estado = NORMAL;

float ax = 0.0;
float ay = 0.0;
float az = 1.0;
float gx = 0.0;
float gy = 0.0;
float gz = 0.0;
float accelTotal = 1.0;
float tiltDeg = 0.0;
float motionScore = 0.0;

float axOffset = 0.0;
float ayOffset = 0.0;
float azOffset = 0.0;
float lastAccelTotal = 1.0;
float lastTiltDeg = 0.0;

unsigned long lastSampleMs = 0;
unsigned long lastTelemetryMs = 0;
unsigned long lastLcdMs = 0;
unsigned long estadoInicioMs = 0;
unsigned long ultimoMovimientoMs = 0;
unsigned long alertaInicioMs = 0;

unsigned int caidasConfirmadas = 0;
bool streamEnabled = true;
bool alertaActiva = false;

String usbBuffer = "";
String btBuffer = "";

const unsigned long SAMPLE_INTERVAL_MS = 50;
const unsigned long TELEMETRY_INTERVAL_MS = 250;
const unsigned long LCD_INTERVAL_MS = 350;
const unsigned long POSIBLE_CAIDA_TIMEOUT_MS = 5000;
const unsigned long INMOVILIDAD_CONFIRMACION_MS = 2500;

const float FREE_FALL_G = 0.55;
const float IMPACT_G = 2.35;
const float TILT_CAIDA_DEG = 55.0;
const float MOVIMIENTO_MINIMO = 0.08;

void setup() {
  pinMode(PIN_LED_VERDE, OUTPUT);
  pinMode(PIN_LED_AMARILLO, OUTPUT);
  pinMode(PIN_LED_ROJO, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  Serial.begin(115200);
  bt.begin(9600);
  Wire.begin();

  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SFA Iniciando");

  iniciarMPU();
  calibrarMPU(120);

  estadoInicioMs = millis();
  ultimoMovimientoMs = millis();
  emitir("BOOT,SFA,1.0");
  emitirEvento("SISTEMA", "inicio");
}

void loop() {
  const unsigned long ahora = millis();

  leerComandos(Serial, usbBuffer);
  leerComandos(bt, btBuffer);

  if (ahora - lastSampleMs >= SAMPLE_INTERVAL_MS) {
    lastSampleMs = ahora;
    leerMPU();
    actualizarEstado(ahora);
    actualizarActuadores(ahora);
  }

  if (streamEnabled && ahora - lastTelemetryMs >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMs = ahora;
    emitirTelemetria(ahora);
  }

  if (ahora - lastLcdMs >= LCD_INTERVAL_MS) {
    lastLcdMs = ahora;
    actualizarLCD();
  }
}

void iniciarMPU() {
  escribirMPU(0x6B, 0x00); // Wake up
  escribirMPU(0x1B, 0x00); // Gyro +/- 250 deg/s
  escribirMPU(0x1C, 0x00); // Accel +/- 2g
}

void escribirMPU(byte reg, byte valor) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(valor);
  Wire.endTransmission(true);
}

int16_t leerInt16() {
  int16_t hi = Wire.read();
  int16_t lo = Wire.read();
  return (hi << 8) | lo;
}

void calibrarMPU(unsigned int muestras) {
  long sx = 0;
  long sy = 0;
  long sz = 0;

  for (unsigned int i = 0; i < muestras; i++) {
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x3B);
    Wire.endTransmission(false);
    Wire.requestFrom(MPU_ADDR, (byte)6, (byte)true);

    sx += leerInt16();
    sy += leerInt16();
    sz += leerInt16();
    delay(8);
  }

  axOffset = (float)sx / muestras / 16384.0;
  ayOffset = (float)sy / muestras / 16384.0;
  azOffset = ((float)sz / muestras / 16384.0) - 1.0;
}

void leerMPU() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, (byte)14, (byte)true);

  int16_t rawAx = leerInt16();
  int16_t rawAy = leerInt16();
  int16_t rawAz = leerInt16();
  leerInt16(); // temperatura interna no usada en esta etapa
  int16_t rawGx = leerInt16();
  int16_t rawGy = leerInt16();
  int16_t rawGz = leerInt16();

  ax = (rawAx / 16384.0) - axOffset;
  ay = (rawAy / 16384.0) - ayOffset;
  az = (rawAz / 16384.0) - azOffset;

  gx = rawGx / 131.0;
  gy = rawGy / 131.0;
  gz = rawGz / 131.0;

  accelTotal = sqrt(ax * ax + ay * ay + az * az);
  if (accelTotal < 0.01) {
    accelTotal = 0.01;
  }

  float zNormalizado = constrain(az / accelTotal, -1.0, 1.0);
  tiltDeg = acos(zNormalizado) * 57.2958;

  motionScore = abs(accelTotal - lastAccelTotal) + abs(tiltDeg - lastTiltDeg) / 90.0;
  lastAccelTotal = accelTotal;
  lastTiltDeg = tiltDeg;
}

void actualizarEstado(unsigned long ahora) {
  if (motionScore > MOVIMIENTO_MINIMO) {
    ultimoMovimientoMs = ahora;
  }

  bool eventoInercial = accelTotal < FREE_FALL_G || accelTotal > IMPACT_G;
  bool posturaCaida = tiltDeg > TILT_CAIDA_DEG;
  bool inmovil = (ahora - ultimoMovimientoMs) > INMOVILIDAD_CONFIRMACION_MS;

  switch (estado) {
    case NORMAL:
      if (eventoInercial) {
        cambiarEstado(EVENTO_INERCIAL, "evento_inercial");
      }
      break;

    case EVENTO_INERCIAL:
      if (posturaCaida) {
        cambiarEstado(POSIBLE_CAIDA, "postura_anomala");
      } else if (ahora - estadoInicioMs > 1500) {
        cambiarEstado(NORMAL, "recuperado");
      }
      break;

    case POSIBLE_CAIDA:
      if (posturaCaida && inmovil) {
        confirmarCaida();
      } else if (ahora - estadoInicioMs > POSIBLE_CAIDA_TIMEOUT_MS) {
        cambiarEstado(NORMAL, "sin_confirmacion");
      }
      break;

    case CAIDA_CONFIRMADA:
      alertaActiva = true;
      break;

    case ALERTA_SILENCIADA:
      if (!posturaCaida && motionScore > MOVIMIENTO_MINIMO) {
        cambiarEstado(NORMAL, "reinicio_por_movimiento");
        alertaActiva = false;
      }
      break;
  }
}

void cambiarEstado(EstadoSistema nuevo, const char *detalle) {
  if (estado == nuevo) {
    return;
  }

  estado = nuevo;
  estadoInicioMs = millis();
  emitirEvento(nombreEstado(), detalle);
}

void confirmarCaida() {
  estado = CAIDA_CONFIRMADA;
  estadoInicioMs = millis();
  alertaInicioMs = estadoInicioMs;
  caidasConfirmadas++;
  alertaActiva = true;
  emitirEvento("CAIDA_CONFIRMADA", "impacto_postura_inmovilidad");
}

void actualizarActuadores(unsigned long ahora) {
  digitalWrite(PIN_LED_VERDE, estado == NORMAL ? HIGH : LOW);
  digitalWrite(PIN_LED_AMARILLO, estado == EVENTO_INERCIAL || estado == POSIBLE_CAIDA ? HIGH : LOW);
  digitalWrite(PIN_LED_ROJO, estado == CAIDA_CONFIRMADA ? HIGH : LOW);

  if (estado == CAIDA_CONFIRMADA && alertaActiva) {
    if ((ahora / 350) % 2 == 0) {
      tone(PIN_BUZZER, 1800);
    } else {
      noTone(PIN_BUZZER);
    }
  } else if (estado == POSIBLE_CAIDA) {
    if ((ahora / 700) % 2 == 0) {
      tone(PIN_BUZZER, 1200, 80);
    }
  } else {
    noTone(PIN_BUZZER);
  }
}

void actualizarLCD() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SFA ");
  lcd.print(nombreEstadoCorto());
  lcd.setCursor(0, 1);
  lcd.print("G:");
  lcd.print(accelTotal, 2);
  lcd.print(" T:");
  lcd.print(tiltDeg, 0);
  lcd.print(" C:");
  lcd.print(caidasConfirmadas);
}

const char *nombreEstado() {
  switch (estado) {
    case NORMAL: return "NORMAL";
    case EVENTO_INERCIAL: return "EVENTO_INERCIAL";
    case POSIBLE_CAIDA: return "POSIBLE_CAIDA";
    case CAIDA_CONFIRMADA: return "CAIDA_CONFIRMADA";
    case ALERTA_SILENCIADA: return "ALERTA_SILENCIADA";
  }
  return "DESCONOCIDO";
}

const char *nombreEstadoCorto() {
  switch (estado) {
    case NORMAL: return "NORMAL";
    case EVENTO_INERCIAL: return "MOV.BRUSCO";
    case POSIBLE_CAIDA: return "POSIBLE";
    case CAIDA_CONFIRMADA: return "ALERTA";
    case ALERTA_SILENCIADA: return "SILENCIO";
  }
  return "ERROR";
}

void emitirTelemetria(unsigned long ahora) {
  String linea = "TEL,";
  linea += String(ahora);
  linea += ",";
  linea += nombreEstado();
  linea += ",";
  linea += String(ax, 3);
  linea += ",";
  linea += String(ay, 3);
  linea += ",";
  linea += String(az, 3);
  linea += ",";
  linea += String(accelTotal, 3);
  linea += ",";
  linea += String(tiltDeg, 1);
  linea += ",";
  linea += String(motionScore, 3);
  linea += ",";
  linea += String(caidasConfirmadas);
  emitir(linea);
}

void emitirEvento(const char *tipo, const char *detalle) {
  String linea = "EVT,";
  linea += String(millis());
  linea += ",";
  linea += tipo;
  linea += ",";
  linea += detalle;
  emitir(linea);
}

void emitir(const String &linea) {
  Serial.println(linea);
  bt.println(linea);
}

void responder(const char *cmd, const char *resultado) {
  String linea = "RSP,";
  linea += cmd;
  linea += ",";
  linea += resultado;
  emitir(linea);
}

void leerComandos(Stream &puerto, String &buffer) {
  while (puerto.available()) {
    char c = puerto.read();
    if (c == '\n' || c == '\r') {
      if (buffer.length() > 0) {
        procesarComando(buffer);
        buffer = "";
      }
    } else if (buffer.length() < 48) {
      buffer += c;
    }
  }
}

void procesarComando(String cmd) {
  cmd.trim();
  cmd.toUpperCase();

  if (cmd == "PING") {
    responder("PING", "OK");
  } else if (cmd == "STREAM ON") {
    streamEnabled = true;
    responder("STREAM", "ON");
  } else if (cmd == "STREAM OFF") {
    streamEnabled = false;
    responder("STREAM", "OFF");
  } else if (cmd == "STATUS") {
    emitirTelemetria(millis());
    responder("STATUS", "OK");
  } else if (cmd == "MUTE") {
    alertaActiva = false;
    if (estado == CAIDA_CONFIRMADA) {
      cambiarEstado(ALERTA_SILENCIADA, "mute_remoto");
    }
    responder("MUTE", "OK");
  } else if (cmd == "RESET") {
    alertaActiva = false;
    cambiarEstado(NORMAL, "reset_remoto");
    responder("RESET", "OK");
  } else if (cmd == "CAL") {
    responder("CAL", "INICIANDO");
    calibrarMPU(120);
    responder("CAL", "OK");
  } else if (cmd == "TEST FALL") {
    confirmarCaida();
    responder("TEST FALL", "OK");
  } else {
    responder("CMD", "DESCONOCIDO");
  }
}
