export interface IUser {
    name: string;
    id: number;
    devices: {
        value: IDevice[];
    };
    lightIndex: number;
}

export interface IDevice {
    MAC_ID: string;
    name: string;
    lightIndex: number;
}
