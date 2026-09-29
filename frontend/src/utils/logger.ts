const isDev = import.meta.env.DEV;

type LogFn = (...args: any[]) => void;

interface Logger {
    log: LogFn;
    warn: LogFn;
    error: LogFn;
    info: LogFn;
    debug: LogFn;
}

export const logger: Logger = {
    log: (...args) => {
        if (isDev) console.log(...args);
    },
    warn: (...args) => {
        if (isDev) console.warn(...args);
    },
    error: (...args) => {
        if (isDev) console.error(...args);
    },
    info: (...args) => {
        if (isDev) console.info(...args);
    },
    debug: (...args) => {
        if (isDev) console.debug(...args);
    },
};
