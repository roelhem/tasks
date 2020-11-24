import PkgBuilder from '../../../src/build/PkgBuilder'
import * as path from 'path'

describe('PkgBuilder', () => {

    describe('constructor', () => {

        test('Can Initialize', () => {
            const builder = new PkgBuilder(path.join(__dirname, 'simple-command.command.ts'))
            expect(builder).toBeInstanceOf(PkgBuilder)
        })

    })

})
