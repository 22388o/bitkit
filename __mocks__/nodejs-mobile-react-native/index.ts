import { ChannelCallback, StartupOptions } from 'nodejs-mobile-react-native';

const nodejsMobileMock =  {
    start: jest.fn((scriptFileName: string, options?: StartupOptions) => {}),
    startWithArgs: jest.fn((command: string, options?: StartupOptions) => {}),
    startWithScript: jest.fn((scriptBody: string, options?: StartupOptions) => {}),
    channel: {
        addListener: jest.fn((event: string, callback: ChannelCallback, context?: any) => {}),
        removeListener: jest.fn((event: string, callback: ChannelCallback, context?: any) => {}),
        post: jest.fn((event: string, ...message: any[]) => {}),
        send: jest.fn((...message: any[]) => {}),
    }
};

module.exports = nodejsMobileMock;
