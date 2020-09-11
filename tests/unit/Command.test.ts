import Command from '../../src/Command'
import {CommandDescription, Task} from '../../src'
import * as yargs from 'yargs'

describe('Command', () => {

    describe('constructor', () => {

        test('Initialises correctly', () => {
            const command = new Command({
                async task(context, args): Promise<void> { console.log(args) },
                exit: false,
            })
            expect(command).toBeInstanceOf(Task)
            expect(command).toBeInstanceOf(Command)
        })

    })

    describe('Usage in yargs', () => {

        const table: [CommandDescription, string[]][] = [
            [{
                async task(context, args): Promise<void> { console.log(args)},
                exit: false,
            }, ['a', 'b']],
            [{
                command: 'test',
                async task(context, args): Promise<void> { console.log(args)},
                exit: false,
            }, ['test', 'a']],
            [{
                command: '$0 <abc>',
                build: (argv) => argv.positional('abc', {type: 'boolean'}),
                async task(context, args): Promise<void> { console.log(args)},
                exit: false,
            }, ['true']],
            [{
                command: 'test [a]',
                build: (argv) => argv.positional('a', {type: 'boolean'}),
                async task(context, args): Promise<void> { console.log(args)},
                exit: false,
            }, ['test', 'false']],
            [{
                build: (argv) => argv.options('arg', {type: 'string'}),
                async task(context, args): Promise<void> { console.log(args)},
                exit: false,
            }, ['--arg', 'a']],
        ]

        test.each(table)('Command %p with input %p', (commandDescription, args) => {
            const command = new Command(commandDescription)
            console.log(
                yargs.command(command).parse(args, {}, (err, argv, output) => {
                    console.log(err, argv, output)
                })
            )
        })

    })

})
