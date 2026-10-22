import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from servidor_pc import main


class AlertCommandTests(unittest.IsolatedAsyncioTestCase):
    async def test_reset_requires_ack_and_clears_only_old_cached_fall(self):
        bridge = main.SerialBridge()
        bridge.latest = {'state': 'CAIDA_CONFIRMADA', 'fall_count': 3}
        bridge.last_response = {'command': 'RESET', 'result': 'OK'}
        def send(command):
            asyncio.get_running_loop().call_soon(
                setattr, bridge, 'last_response', {'command': command, 'result': 'OK'})
        with patch.object(bridge, 'send_command', side_effect=send) as command:
            await bridge.confirm_alert_command('RESET')
        command.assert_called_once_with('RESET')
        self.assertIsNone(bridge.latest)

    async def test_old_ack_does_not_satisfy_new_reset(self):
        bridge = main.SerialBridge()
        bridge.last_response = {'command': 'RESET', 'result': 'OK'}
        with patch.object(bridge, 'send_command'):
            with self.assertRaises(TimeoutError):
                await bridge.confirm_alert_command('RESET', timeout=.03)

    async def test_new_fall_after_reset_is_not_discarded(self):
        bridge = main.SerialBridge()
        bridge.latest = {'state': 'CAIDA_CONFIRMADA', 'fall_count': 3}
        def send(command):
            bridge.latest = {'state': 'CAIDA_CONFIRMADA', 'fall_count': 4}
            bridge.last_response = {'command': command, 'result': 'OK'}
        with patch.object(bridge, 'send_command', side_effect=send):
            await bridge.confirm_alert_command('RESET')
        self.assertEqual(bridge.latest['fall_count'], 4)

    async def test_attended_and_false_alarm_reset_while_mute_only_mutes(self):
        for action, command in [('attended', 'RESET'), ('false_alarm', 'RESET'), ('mute', 'MUTE')]:
            with self.subTest(action=action), patch.object(main.bridge, 'status', return_value={'connected': True}), \
                    patch.object(main.bridge, 'confirm_alert_command', new_callable=AsyncMock) as send, \
                    patch.object(main, 'save_record') as save, patch.object(main.bridge, 'broadcast', new_callable=AsyncMock):
                result = await main.alert_action(main.AlertActionRequest(action=action))
                send.assert_awaited_once_with(command)
                self.assertTrue(result['device_confirmed'])
                save.assert_called_once()

    async def test_failed_hardware_confirmation_does_not_record_success(self):
        with patch.object(main.bridge, 'status', return_value={'connected': True}), \
                patch.object(main.bridge, 'confirm_alert_command', new_callable=AsyncMock, side_effect=TimeoutError('No responde')), \
                patch.object(main, 'save_record') as save, patch.object(main.bridge, 'broadcast', new_callable=AsyncMock) as publish:
            with self.assertRaises(HTTPException) as error:
                await main.alert_action(main.AlertActionRequest(action='attended'))
            self.assertEqual(error.exception.status_code, 504)
            save.assert_not_called()
            publish.assert_not_awaited()

    async def test_disconnected_attention_does_not_claim_hardware_ack(self):
        with patch.object(main.bridge, 'status', return_value={'connected': False}), \
                patch.object(main, 'save_record'), patch.object(main.bridge, 'broadcast', new_callable=AsyncMock):
            result = await main.alert_action(main.AlertActionRequest(action='attended'))
            self.assertFalse(result['device_confirmed'])
            self.assertIsNone(result['device_command'])


if __name__ == '__main__':
    unittest.main()
