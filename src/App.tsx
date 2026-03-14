/* eslint-disable @typescript-eslint/no-unused-vars */

import { useState, useEffect, useRef } from 'react';
import './App.css'
import type { UARTData } from './Interfaces';
import type { TempPoint } from './components/TemperatureChart';
import { TemperatureChart } from './components/TemperatureChart';
import { BatteryUsageIndicator } from './components/BatteryUsageIndicator';

function computeAutoTargets(temp: number): { fan: number; heater: number; label: string } {
  if (temp > 15) return { fan: 2, heater: 0, label: "Cooling hard (Fan High)" };
  if (temp > 10) return { fan: 1, heater: 0, label: "Cooling gently (Fan Low)" };
  if (temp < -5)  return { fan: 0, heater: 2, label: "Heating hard (Heater High)" };
  if (temp < 0)   return { fan: 0, heater: 1, label: "Heating gently (Heater Low)" };
  return { fan: 0, heater: 0, label: "In range - all off" };
}

function App() {
  const [data, setData] = useState<UARTData | null>(null);
  const [tempHistory, setTempHistory] = useState<TempPoint[]>([]);
  const [autoControl, setAutoControl] = useState(false);
  const [lastKnownBattery, setLastKnownBattery] = useState<number | null>(null);
  const autoControlRef = useRef(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    autoControlRef.current = autoControl;
  }, [autoControl]);

  useEffect(() => {
    const wssurl = "wss://polarnode.alsoft.nl";
    ws.current = new WebSocket(wssurl);
    ws.current.binaryType = "arraybuffer";

    ws.current.onopen = () => console.log("Connected to PolarNode");
    ws.current.onclose = () => console.log("Disconnected");

    ws.current.onmessage = (event) => {
      const parsed = parseUARTData(event.data);
      if (parsed) {
        setData(parsed);

        if (parsed.battery !== undefined) {
          setLastKnownBattery(parsed.battery);
        }

        const now = Date.now();
        const cutoff = now - 60_000;
        setTempHistory((prev) => {
          const updated = [...prev, { t: now, temp: parsed.temp }];
          return updated.filter((p) => p.t >= cutoff);
        });
      }
    };
    return () => {
      ws.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!autoControl || !data) return;

    const { fan: targetFan, heater: targetHeater } = computeAutoTargets(data.temp);

    if (data.fan !== targetFan) {
      sendCommand(ws.current, 0x01, targetFan);
    }
    if (data.heater !== targetHeater) {
      sendCommand(ws.current, 0x02, targetHeater);
    }
  }, [data, autoControl]);

  const autoStatus = data ? computeAutoTargets(data.temp).label : null;

  return (
    <>
      <div>
        <h1>PolarNode</h1>
        {data ? (
          <div>
            <p>ID: 0x{data.id.toString(16).toUpperCase().padStart(4, '0')}</p>
            <p>Temperature: {data.temp}</p>
            <TemperatureChart points={tempHistory} />
            <p>Fan: {fanHeaterLabel(data.fan)}</p>
            <p>Heater: {fanHeaterLabel(data.heater)}</p>
            <BatteryUsageIndicator fan={data.fan} heater={data.heater} />
            <p>Battery: {data.battery !== undefined ? `${data.battery}%` : (lastKnownBattery !== null ? `${lastKnownBattery}%` : "N/A")}</p>
            <p>Status: {checkStatus(data.status)}</p>
          </div>
        ) : <p>waiting for data!!</p>}

        <div className="auto-control-row">
          <button
            className={`auto-toggle${autoControl ? " auto-toggle--on" : ""}`}
            onClick={() => setAutoControl((prev) => !prev)}
          >
            Auto: {autoControl ? "ON" : "OFF"}
          </button>
          {autoControl && autoStatus && (
            <span className="auto-status">{autoStatus}</span>
          )}
        </div>

        <p>Fan: </p>
        {([0, 1, 2] as const).map((value) => (
          <button
            key={value}
            className={data?.fan === value ? "active" : ""}
            disabled={autoControl}
            onClick={() => sendCommand(ws.current, 0x01, value)}>
            {fanHeaterLabel(value)}
          </button>
        ))}
        <p>Heater: </p>
        {([0, 1, 2] as const).map((value) => (
          <button
            key={value}
            className={data?.heater === value ? "active" : ""}
            disabled={autoControl}
            onClick={() => sendCommand(ws.current, 0x02, value)}>
            {fanHeaterLabel(value)}
          </button>
        ))}
      </div>
    </>
  );
}

function fanHeaterLabel(value: number): string {
  if (value === 0) return "Off";
  if (value === 1) return "Low";
  if (value === 2) return "High";
  return "Off";
}

function checkStatus(status: number) {
  console.log(status);
  //did it like 0-1-2-3-4 before remembering how I was supposed to do it :D
  // should I have done it with bitwise operations..? 
  // would it be more efficient?
  if (status === 0) {
    return "OK";
  }
  
  const statusMessages: string[] = [];
  
  if (status & (1 << 0)) statusMessages.push("Power Issues");
  if (status & (1 << 1)) statusMessages.push("Too Cold");
  if (status & (1 << 2)) statusMessages.push("Too Hot");
  if (status & (1 << 3)) statusMessages.push("Control Error");
  if (status & (1 << 4)) statusMessages.push("Requires Maintenance");
  
  if (statusMessages.length === 0) {
    return "Unknown Status";
  }
  else {
    return statusMessages.join(", ");
  }
}

function parseUARTData(buf: ArrayBuffer): UARTData | undefined {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  if (bytes.length < 10) return undefined;
  if (view.getUint8(0) !== 0xAB) return undefined;

  const statusOffset = bytes.length - 3;
  
  const payload = bytes.slice(0, bytes.length - 2);
  const receivedCrc = (view.getUint8(bytes.length - 2) << 8) | view.getUint8(bytes.length - 1);
  
  if (calculateCrc16(payload) !== receivedCrc) {
    console.error("CRC Mismatch");
    return undefined;
  }
  const id = view.getUint16(1, true);
  const tempRaw = view.getUint16(3, true);
  const temp = decodeFloat16(tempRaw);

  const fan = view.getUint8(5);
  const heater = view.getUint8(6);

  const status = view.getUint8(statusOffset);

  const optionalLen = statusOffset - 7;
  let battery: number | undefined;
  if (optionalLen === 1) battery = view.getUint8(7);
  else if (optionalLen === 0) battery = undefined;
  else return undefined;

  return { id, temp, fan, heater, battery, status };
}


function decodeFloat16(h: number): number {
  const sign = (h & 0x8000) ? -1 : 1;
  const exp = (h >> 10) & 0x1f;
  const frac = h & 0x03ff;

  if (exp === 0) return sign * Math.pow(2, -14) * (frac / 1024);
  if (exp === 31) return frac ? NaN : sign * Infinity;
  return sign * Math.pow(2, exp - 15) * (1 + frac / 1024);
}

function calculateCrc16(data: Uint8Array): number {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= (data[i] << 8);
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc;
}
function sendCommand(ws: WebSocket | null, commandType: number, value: number) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error("no websocket");
    return;
  }
  const payload = new Uint8Array(3);
  payload[0] = 0xBA;
  payload[1] = commandType;
  payload[2] = value;

  const crc = calculateCrc16(payload);//added the paylod array because otherwise the crc calculation didnt work correct
  const command = new Uint8Array(5);
  command[0] = payload[0];
  command[1] = payload[1];
  command[2] = payload[2];
  command[3] = (crc >> 8) & 0xFF;
  command[4] = crc & 0xFF;
  ws.send(command);
}

export default App
