interface UARTData {
    id: number;
    temp: number;
    fan: boolean;
    heater: boolean;
    battery: number;
    status: number;
}
export type { UARTData };