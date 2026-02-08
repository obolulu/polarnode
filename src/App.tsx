/* eslint-disable @typescript-eslint/no-unused-vars */

import { useState, useEffect, useRef } from 'react';
import './App.css'
import type { UARTData } from './Interfaces';


function App() {
  const [data, setData] = useState<UARTData | null> (null);
  const ws = useRef<WebSocket | null>(null);

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
      }
    };
    return () => {
      ws.current?.close();
    };
  }, []);
  
  return (
    <>
      <div>
        <h1>PolarNode</h1>
        {data? (
        <div>
        <p>ID: {data.id}</p>
        <p>Temperature: {data.temp}</p>
        <p>Fan: {data.fan ? "On" : "Off"}</p>
        <p>Heater: {data.heater ? "On" : "Off"}</p>
        <p>Battery: {data.battery}%</p>
        <p>Status: {checkStatus(data.status)}</p>
        </div>
        ) : <p>waiting for data!!</p>}
        {/*one button to toggle fan, one to toggle heater*/}
        <button onClick={() => sendCommand(ws.current, 0x01, data?.fan ? 0 : 1)}>Toggle Fan</button>
        <button onClick={() => sendCommand(ws.current, 0x02, data?.heater ? 0 : 1)}>Toggle Heater</button>
      </div>
    </>
  )
}

function checkStatus(status: number) {
  console.log(status);
  //did it like 0-1-2-3-4 before remembering how I was supposed to do it :D
  // should I have done it with bitwise operations..? 
  // would it be more efficient?
  if (status === 0) {
    return "OK";
  }
  else if (status === 1) {
    return "Offline";
  } else if (status === 2) {
    return "Too cold";
  } else if (status === 4) {
    return "Too hot";
  }
  else if (status === 8) {
    return "Control error";
  }
  else {
    return "Unknown error";
  }
}

function parseUARTData(buf: ArrayBuffer): UARTData | undefined {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  if (bytes.length < 10) return undefined;
  if (view.getUint8(0) !== 0xAB) return undefined;

  const crcOffset = bytes.length - 2;
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

  const fan = view.getUint8(5) === 1;
  const heater = view.getUint8(6) === 1;

  const status = view.getUint8(statusOffset);

  const optionalLen = statusOffset - 7;
  let battery: number | undefined;
  if (optionalLen === 1) battery = view.getUint8(7);
  else if (optionalLen === 0) battery = undefined;
  else return undefined;

  return { id, temp, fan, heater, battery: battery ?? -1, status };
}


function decodeFloat16(h: number): number {
  const sign = (h & 0x8000) ? -1 : 1;
  const exp = (h >> 10) & 0x1f;
  const frac = h & 0x03ff;

  if (exp === 0) return sign * Math.pow(2, -14) * (frac / 1024);
  if (exp === 31) return frac ? NaN : sign * Infinity;
  return sign * Math.pow(2, exp - 15) * (1 + frac / 1024);
}


function crc16X25(bytes: Uint8Array, length: number): number {
  let crc = 0xffff;
  for (let i = 0; i < length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >> 1) ^ ((crc & 1) ? 0x8408 : 0);
    }
  }
  return (crc ^ 0xffff) & 0xffff;
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
