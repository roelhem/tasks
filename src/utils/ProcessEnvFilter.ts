import Callable from './Callable'
import {ProcessEnvFilterSettings} from '../types'

export default class ProcessEnvFilter extends Callable<(env?: NodeJS.ProcessEnv) => NodeJS.ProcessEnv> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- STATIC HELPER METHODS --------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    static applyOnEntry(settings: ProcessEnvFilterSettings, key: string, value: string|undefined): boolean {
        if(Array.isArray(settings)) {
            for (const subFilter of settings) {
                if(ProcessEnvFilter.applyOnEntry(subFilter, key, value)) {
                    return true
                }
            }
            return false
        } else {
            if(typeof settings === 'string') {
                return settings === key
            } else if(typeof settings === 'boolean') {
                return settings
            } else if(settings instanceof RegExp) {
                return settings.test(key)
            } else {
                return settings(key, value)
            }
        }
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    settings: ProcessEnvFilterSettings

    constructor(settings?: ProcessEnvFilterSettings) {
        super('invoke')
        this.settings = settings || true
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INVOKE METHOD ----------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    invoke(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
        if(this.settings === true) {
            return env
        } else if(this.settings === false) {
            return {}
        } else {
            return Object.fromEntries(
                Object.entries(env).filter(([key, value]) => ProcessEnvFilter.applyOnEntry(this.settings, key, value))
            )
        }
    }



}
