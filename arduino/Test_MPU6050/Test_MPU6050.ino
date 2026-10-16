#include <Wire.h>

/*
  Prueba independiente del MPU6050 para Arduino UNO.
  Conexiones: VCC->5V (GY-521), GND->GND, SDA->A4, SCL->A5.
  Monitor Serie: 115200 baudios.
*/

const byte MPU_ADDR = 0x68;
const unsigned long INTERVALO_MS = 250;

unsigned long ultimaLecturaMs = 0;
bool mpuDisponible = false;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  delay(300);

  Serial.println(F("=== TEST MPU6050 ==="));
  Serial.println(F("SDA=A4, SCL=A5, Monitor Serie=115200"));

  mpuDisponible = detectarMPU();
  if (!mpuDisponible) {
    Serial.println(F("ERROR: MPU6050 no detectado en 0x68."));
    Serial.println(F("Revise VCC, GND, SDA y SCL."));
    return;
  }

  escribirRegistro(0x6B, 0x00);
  escribirRegistro(0x1B, 0x00);
  escribirRegistro(0x1C, 0x00);

  Serial.println(F("OK: MPU6050 detectado y configurado."));
  Serial.println(F("ax_g,ay_g,az_g,total_g,tilt_deg,gx_dps,gy_dps,gz_dps"));
}

void loop() {
  if (!mpuDisponible) {
    delay(1000);
    return;
  }

  const unsigned long ahora = millis();
  if (ahora - ultimaLecturaMs < INTERVALO_MS) return;
  ultimaLecturaMs = ahora;

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) {
    Serial.println(F("ERROR: se perdio la comunicacion con el MPU6050."));
    return;
  }

  if (Wire.requestFrom(MPU_ADDR, (byte)14, (byte)true) != 14) {
    Serial.println(F("ERROR: lectura I2C incompleta."));
    return;
  }

  const int16_t rawAx = leerInt16();
  const int16_t rawAy = leerInt16();
  const int16_t rawAz = leerInt16();
  leerInt16();
  const int16_t rawGx = leerInt16();
  const int16_t rawGy = leerInt16();
  const int16_t rawGz = leerInt16();

  const float ax = rawAx / 16384.0;
  const float ay = rawAy / 16384.0;
  const float az = rawAz / 16384.0;
  const float total = sqrt(ax * ax + ay * ay + az * az);
  const float tilt = atan2(sqrt(ax * ax + ay * ay), fabs(az)) * 180.0 / PI;

  imprimirValor(ax);
  imprimirValor(ay);
  imprimirValor(az);
  imprimirValor(total);
  imprimirValor(tilt);
  imprimirValor(rawGx / 131.0);
  imprimirValor(rawGy / 131.0);
  Serial.println(rawGz / 131.0, 3);
}

bool detectarMPU() {
  Wire.beginTransmission(MPU_ADDR);
  if (Wire.endTransmission() != 0) return false;

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x75);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(MPU_ADDR, (byte)1, (byte)true) != 1) return false;

  const byte identidad = Wire.read();
  Serial.print(F("WHO_AM_I=0x"));
  Serial.println(identidad, HEX);
  return identidad == 0x68;
}

void escribirRegistro(byte registro, byte valor) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(registro);
  Wire.write(valor);
  Wire.endTransmission(true);
}

int16_t leerInt16() {
  const int16_t alto = Wire.read();
  const int16_t bajo = Wire.read();
  return (alto << 8) | bajo;
}

void imprimirValor(float valor) {
  Serial.print(valor, 3);
  Serial.print(',');
}
