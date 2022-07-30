import { Token } from './syntax'

export function logError(token: Token, fmt: string, ...args: any[]) {
    return console.error(`%s:%d:%d:${fmt}`, token.source, token.line, token.column, ...args)
}
export function logInfo(token: Token, fmt: string, ...args: any[]) {
    return console.info(`%s:%d:%d:${fmt}`, token.source, token.line, token.column, ...args)
}
export function logWarn(token: Token, fmt: string, ...args: any[]) {
    return console.warn(`%s:%d:%d:${fmt}`, token.source, token.line, token.column, ...args)
}
export function logDebug(token: Token, fmt: string, ...args: any[]) {
    return console.debug(`%s:%d:%d:${fmt}`, token.source, token.line, token.column, ...args)
}