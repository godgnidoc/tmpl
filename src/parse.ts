import { Block, Branch, Call, Case, Eval, Extends, For, Fragment, Override, reg_table, Text, Token, Use } from "./syntax"
import { logError } from "./util"

const leadings = ['extends', 'text', 'eval', 'call', 'block', 'for', 'case', 'use', 'override', 'branch']
class ParsingContext {
    first: boolean = true
    for: number = 0
    case: number = 0
    block: number = 0
    override: number = 0
    branch: number = 0
    extending: boolean = false
}

export default function parse(tokens: Token[]) {
    let tmpl: Fragment[] = []

    let context = new ParsingContext()

    let correct = true
    for (let it = 0; it < tokens.length; it++) {
        let token = tokens[it]
        if (leadings.includes(token.type)) {
            let [frag, cost] = parseFragment(tokens, it, context)
            tmpl.push(frag)
            it += cost - 1
        } else {
            logError(token, 'invalid %s token here parsing template', token.type)
            correct = false
        }
        if (token.type != 'text' || token.text.trim())
            context.first = false
    }

    if (correct)
        return tmpl
    throw new Error()
}

const parser_table: { [type: string]: (tokens: Token[], it: number, context: ParsingContext) => [Fragment, number] } = {
    text: parseText,
    eval: parseEval,
    call: parseCall,
    block: parseBlock,
    for: parseFor,
    use: parseUse,
    override: parseOverride,
    branch: parseBranch,
    case: parseCase,
    extends: parseExtends
}

function parseFragment(tokens: Token[], it: number, context: ParsingContext): [Fragment, number] {
    let token = tokens[it]
    return parser_table[token.type](tokens, it, context)
}

function parseExtends(tokens: Token[], it: number, context: ParsingContext): [Extends, number] {
    let token = tokens[it]
    if (token.type != 'extends')
        throw new Error()

    if (context.extending) {
        logError(token, 'duplicate extending token')
        throw new Error()
    }

    if (!context.first) {
        logError(token, 'extending token should be the first token in context')
        throw new Error()
    }

    let match = token.text.match(reg_table.extends)
    let frag = <Extends>{
        type: 'extends',
        spec: match[1],
        content: []
    }

    it += 1
    context.extending = true
    let cost = 1
    let correct = true
    while (it < tokens.length) {
        let token = tokens[it]
        if (token.type == 'text') {
            cost += 1
            it += 1
        } else if ('override' == token.type) {
            let [frg, cst] = parseOverride(tokens, it, context)
            frag.content.push(frg)
            cost += cst
            it += cst
        } else {
            cost += 1
            logError(token, 'invalid %s token here parsing extends', token.type)
            correct = false
        }
    }

    if (correct)
        return [frag, cost]
    throw new Error()
}

function parseText(tokens: Token[], it: number, _context: ParsingContext): [Text, number] {
    let token = tokens[it]
    if (token.type != 'text')
        throw new Error()
    return [{
        type: 'text',
        text: token.text
    }, 1]
}
function parseEval(tokens: Token[], it: number, _context: ParsingContext): [Eval, number] {
    let token = tokens[it]
    if (token.type != 'eval')
        throw new Error()
    let match = token.text.match(reg_table.eval)
    return [{
        type: 'eval',
        expr: match[1],
        args: match[2],
        indent: token.text.endsWith('-}}') ? 0 : token.column - 1
    }, 1]
}
function parseCall(tokens: Token[], it: number, _context: ParsingContext): [Call, number] {
    let token = tokens[it]
    if (token.type != 'call')
        throw new Error()
    let match = token.text.match(reg_table.call)
    return [{
        type: 'call',
        spec: match[1],
        model: match[2],
        indent: token.text.endsWith('-}}') ? 0 : token.column - 1
    }, 1]
}
function parseOverride(tokens: Token[], it: number, context: ParsingContext): [Override, number] {
    let token = tokens[it]
    if (token.type != 'override')
        throw new Error()

    if (context.override) {
        logError(token, 'override token in overriding context is not allowed')
        throw new Error()
    }

    if (!context.extending) {
        logError(token, 'override token applies only in extending context')
        throw new Error()
    }

    let match = token.text.match(reg_table.override)
    let frag = <Override>{
        type: 'override',
        content: [],
        name: match[1],
        trimStart: token.text.endsWith('-}}'),
        trimEnd: false
    }

    it += 1
    context.override += 1
    let cost = 1
    let correct = true
    let end = false
    while (it < tokens.length) {
        let token = tokens[it]
        if (token.type == 'endoverride') {
            if (token.text.startsWith('{{/-'))
                frag.trimEnd = true
            cost += 1
            context.override -= 1
            end = true
            break
        } else if (leadings.includes(token.type)) {
            let [frg, cst] = parseFragment(tokens, it, context)
            frag.content.push(frg)
            cost += cst
            it += cst
        } else {
            cost += 1
            logError(token, 'invalid %s token here parsing override', token.type)
            correct = false
        }
    }

    if (!end) {
        console.error('%s: unterminated override', token.source)
        correct = false
    }

    if (correct)
        return [frag, cost]
    throw new Error()
}
function parseBlock(tokens: Token[], it: number, context: ParsingContext): [Block, number] {
    let token = tokens[it]
    if (token.type != 'block')
        throw new Error()

    if (context.block || context.for | context.branch) {
        logError(token, 'illegal block token in current context')
        throw new Error()
    }

    let match = token.text.match(reg_table.block)
    let frag = <Block>{
        type: 'block',
        name: match[1],
        content: [],
        indent: token.column - 1,
        trimStart: token.text.endsWith('-}}') || token.text.endsWith('-/}}'),
        trimEnd: token.text.endsWith('-/}}')
    }

    if (token.text.endsWith('/}}'))
        return [frag, 1]

    it += 1
    context.block += 1
    let cost = 1
    let correct = true
    let end = false
    while (it < tokens.length) {
        let token = tokens[it]
        if (token.type == 'endblock') {
            if (token.text.startsWith('{{/-'))
                frag.trimEnd = true
            cost += 1
            context.block -= 1
            end = true
            break
        } else if (leadings.includes(token.type)) {
            let [frg, cst] = parseFragment(tokens, it, context)
            frag.content.push(frg)
            cost += cst
            it += cst
        } else {
            cost += 1
            logError(token, 'invalid %s token here parsing block', token.type)
            correct = false
        }
    }

    if (!end) {
        console.error('%s: unterminated block', token.source)
        correct = false
    }

    if (correct)
        return [frag, cost]
    throw new Error()
}
function parseUse(tokens: Token[], it: number, context: ParsingContext): [Use, number] {
    let token = tokens[it]
    if (token.type != 'use')
        throw new Error()

    let match = token.text.match(reg_table.use)
    let frag = <Use>{
        type: 'use',
        expr: match[1],
        content: [],
        trimStart: token.text.endsWith('-}}'),
        trimEnd: false
    }

    it += 1;
    let cost = 1
    let correct = true
    let end = false
    while (it < tokens.length) {
        let token = tokens[it]
        if (token.type == 'enduse') {
            if (token.text.startsWith('{{/-'))
                frag.trimEnd = true
            cost += 1
            end = true
            break
        } else if (leadings.includes(token.type)) {
            let [frg, cst] = parseFragment(tokens, it, context)
            frag.content.push(frg)
            cost += cst
            it += cst
        } else {
            cost += 1
            logError(token, 'invalid %s token here parsing use', token.type)
            correct = false
        }
    }

    if (!end) {
        console.error('%s: unterminated use', token.source)
        correct = false
    }

    if (correct)
        return [frag, cost]
    throw new Error()
}
function parseCase(tokens: Token[], it: number, context: ParsingContext): [Case, number] {
    let token = tokens[it]
    if (token.type != 'case')
        throw new Error()

    if (!context.for || context.case) {
        logError(token, 'illegal case token in current context')
        throw new Error()
    }

    let match = token.text.match(reg_table.case)
    let frag = <Case>{
        type: 'case',
        case: match[1],
        content: [],
        trimStart: token.text.endsWith('-}}'),
        trimEnd: false
    }

    it += 1
    context.case += 1
    let cost = 1
    let correct = true
    let end = false
    while (it < tokens.length) {
        let token = tokens[it]
        if (token.type == 'endcase') {
            if (token.text.startsWith('{{/-'))
                frag.trimEnd = true
            cost += 1
            context.case -= 1
            end = true
            break
        } else if (leadings.includes(token.type)) {
            let [frg, cst] = parseFragment(tokens, it, context)
            frag.content.push(frg)
            cost += cst
            it += cst
        } else {
            cost += 1
            logError(token, 'invalid %s token here parsing case', token.type)
            correct = false
        }
    }

    if (!end) {
        console.error('%s: unterminated case', token.source)
        correct = false
    }

    if (correct)
        return [frag, cost]
    throw new Error()
}
function parseFor(tokens: Token[], it: number, context: ParsingContext): [For, number] {
    let token = tokens[it]
    if (token.type != 'for')
        throw new Error()

    let match = token.text.match(reg_table.for)
    let frag = <For>{
        type: 'for',
        value: match[1],
        key: match[2],
        expr: match[3],
        content: [],
        trimStart: token.text.endsWith('-}}'),
        trimEnd: false
    }

    it += 1
    context.for += 1
    let cost = 1
    let correct = true
    let end = false
    while (it < tokens.length) {
        let token = tokens[it]
        if (token.type == 'endfor') {
            if (token.text.startsWith('{{/-'))
                frag.trimEnd = true
            cost += 1
            context.for -= 1
            end = true
            break
        } else if (leadings.includes(token.type)) {
            let [frg, cst] = parseFragment(tokens, it, context)
            frag.content.push(frg)
            cost += cst
            it += cst
        } else {
            cost += 1
            logError(token, 'invalid %s token here parsing for', token.type)
            correct = false
        }
    }

    if (!end) {
        console.error('%s: unterminated for', token.source)
        correct = false
    }

    if (correct)
        return [frag, cost]
    throw new Error()
}
function parseBranch(tokens: Token[], it: number, context: ParsingContext): [Branch, number] {
    let token = tokens[it]
    if (token.type != 'branch')
        throw new Error()

    let match = token.text.match(reg_table.branch)
    let frag = <Branch>{
        type: 'branch',
        cond: match[1],
        if: [],
        else: [],
        trimIfStart: token.text.endsWith('-}}'),
        trimIfEnd: false,
        trimElseStart: false,
        trimElseEnd: false
    }

    it += 1
    context.branch += 1
    let cost = 1
    let correct = true
    let end = false
    let el = false
    while (it < tokens.length) {
        let token = tokens[it]
        if (token.type == 'endbranch') {
            if (token.text.startsWith('{{/-')) {
                if (el)
                    frag.trimElseEnd = true
                else
                    frag.trimIfEnd = true
            }
            cost += 1
            context.branch -= 1
            end = true
            break
        } else if (token.type == 'else') {
            if (el) {
                logError(token, 'duplicate else token for branch')
                throw new Error()
            }
            if (token.text.startsWith('{{#-'))
                frag.trimIfEnd = true
            if (token.text.endsWith('-}}'))
                frag.trimElseStart = true
            el = true
            cost += 1
            it += 1
        } else if (leadings.includes(token.type)) {
            let [frg, cst] = parseFragment(tokens, it, context)
            if (el)
                frag.else.push(frg)
            else
                frag.if.push(frg)
            cost += cst
            it += cst
        } else {
            cost += 1
            logError(token, 'invalid %s token here parsing branch', token.type)
            correct = false
        }
    }

    if (!end) {
        console.error('%s: unterminated branch', token.source)
        correct = false
    }

    if (correct)
        return [frag, cost]
    throw new Error()
}