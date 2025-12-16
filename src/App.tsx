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
        <button onClick={() => ConstructCommand("0x01" + data?.heater)}>Toggle Fan</button>
        <button onClick={() => ConstructCommand("0x02" + data?.heater)}>Toggle Heater</button>
      </div>
    </>
  )
}

function ConstructCommand(command: string){
  
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

function parseUARTData(data: ArrayBuffer) : UARTData {
  const view = new DataView(data);
  //console.log(data);
  const id = view.getUint16(1, true);
  const temp = view.getInt16(3, true);
  const fan = view.getInt8(5) === 1;
  const heater = view.getInt8(6) === 1;
  const battery = view.getInt8(7);
  const status = view.getInt8(8);
  return { id, temp, fan, heater, battery, status };
}



export default App
