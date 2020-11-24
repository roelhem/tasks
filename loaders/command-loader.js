export default function(source) {
    const execCode = `
        (function() {
            const commands = Array.isArray(cmd) ? cmd : [cmd];
            const yargs = require('yargs');
            for(const command of commands) {
                yargs.command(command);
            }
            yargs.parse();
        })();
    `
}
