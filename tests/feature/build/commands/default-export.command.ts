import {CommandDescription, Command} from '../../../../lib'

export default new Command({
    async task(context, args) {
        console.log(JSON.stringify(args))
    },
    build:(yargs) => yargs.option('myOption', {
            type: 'string',
            describe: 'this is my option',
        }),
})
