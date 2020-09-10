
export const invoke: unique symbol = Symbol('Callable.invoke')

/**
 * The type for a callable method.
 */
export type Callable<F extends (...args: any[]) => any> = F & {
    [invoke](...args: Parameters<F>): ReturnType<F>
}

export interface CallableConstructor {
    new <F extends (...args: any[]) => any>(): Callable<F>
    new <F extends (...args: any[]) => any>(invoke: F): Callable<F>
    new <F extends (...args: any[]) => any>(property: string|symbol|number): Callable<F>
    readonly invoke: typeof invoke
    prototype: typeof Function.prototype
}

// tslint:disable-next-line:only-arrow-functions
export const Callable: CallableConstructor = (function(): CallableConstructor {
    function Callable<F extends (...args: any[]) => any>(this: any, arg0?: F|string|symbol|number) {
        // Getting the invoke function.
        let invokeFunc: F
        const name = `invoke${this.constructor.name}`
        if(typeof arg0 === 'function') {
            invokeFunc = arg0
            this[invoke] = invokeFunc
        } else {
            const property = arg0 === undefined ? invoke : arg0
            if(typeof this.constructor.prototype[property] === 'function') {
                invokeFunc = this.constructor.prototype[property]
                if(property !== invoke) {
                    this[invoke] = invokeFunc
                }
            } else {
                function defaultInvokeFunc(this: any, ...args: Parameters<F>): ReturnType<F> {
                    const func = this[property]
                    if(typeof func === 'function') {
                        return func.apply(this, args)
                    } else {
                        throw new Error(`Can't call property '${property.toString()}'.`)
                    }
                }

                invokeFunc = defaultInvokeFunc as F
            }
        }

        // Getting the result
        const result = (...args: Parameters<F>) => {
            return invokeFunc.apply(result, args)
        }

        // Setting the prototype
        Object.setPrototypeOf(result, this.constructor.prototype)
        Object.getOwnPropertyNames(invokeFunc).forEach((p) => {
            const propertyDescriptor = Object.getOwnPropertyDescriptor(invokeFunc, p) as PropertyDescriptor
            if(p === 'name') { propertyDescriptor.value = name }
            Object.defineProperty(result, p, propertyDescriptor)
        })

        // Return the result
        return result
    }

    // Storing the invoke symbol as a static variable.
    Callable.invoke = invoke

    // Setting the prototype to show that we are thinking about a function.
    Callable.prototype = Object.create(Function.prototype)

    // Return the constructor.
    return (Callable as unknown) as CallableConstructor
}())

export default Callable
