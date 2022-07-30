import { Token, reg_table } from "./syntax"


function preprocess(tokens: Token[], empty: string) {
    let ety = RegExp(
        empty.replace(
            /(\*|\+|\?|\.|\\|\/|\(|\)|\[|\]|\{|\}|\$|\^|\|)/g,
            '\\$1'
        ),
        'g'
    )

    let correct = true
    let result: Token[] = []

    for (let token of tokens) {
        if (token.text.startsWith('{{')) {
            for (const type in reg_table) {
                if (token.text.match(reg_table[type])) {
                    Object.defineProperty(token, 'type', {
                        enumerable: true,
                        configurable: false,
                        writable: false,
                        value: type
                    })
                    break
                }
            }
            if (!token.type) {
                console.error('%s:%d:%d: unrecognized token %s', token.source, token.line, token.column, token.text)
                correct = false
            } else {
                result.push(token)
            }
        } else {
            token.type = 'text'
            token.text = token.text.replace(ety, '')
            if (token.text) {
                if (result.length && result[result.length - 1].type == 'text')
                    result[result.length - 1].text += token.text
                else
                    result.push(token)
            }
        }
    }

    if (correct)
        return result
    throw new Error()
}

export default function scan(source: string, spec: string, empty: string) {
    let lines = source.split('\n')
    let tokens: Token[] = []

    let line = 1

    for (let lno in lines) {
        let cur = lines[lno]
        let column = 1

        while (cur) {
            let match = cur.match(/\{\{.+?\}\}/)
            if (match) {
                if (match.index) {
                    tokens.push({
                        source: spec,
                        line, column: column,
                        text: cur.slice(0, match.index)
                    })
                } else {
                    match.index = 0
                }

                tokens.push({
                    source: spec,
                    line, column: column + match.index,
                    text: match[0]
                })
                column = column + match.index + match[0].length
                cur = cur.slice(match.index + match[0].length)
            } else {
                tokens.push({
                    source: spec,
                    line, column, text: cur
                })
                column += cur.length
                cur = ''
            }
        }

        if( parseInt(lno) < lines.length - 1 ) {
            if (tokens.length && !tokens[tokens.length - 1].text.endsWith("}}"))
                tokens[tokens.length - 1].text += "\n"
            else
                tokens.push({ source: spec, line, column, text: "\n" })
        }

        line += 1
    }

    tokens = preprocess(tokens, empty)
    return tokens
};