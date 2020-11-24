import {CommandDescription, Command} from '../../../../lib'

console.log('CREATING THE SIMPLE COMMAND.')

const simple: CommandDescription = {
    async task(context, args) {
        console.log(JSON.stringify(args))
    }
}

module.exports = new Command(simple)
