import { Block, Branch, Call, Case, Eval, Extends, For, Fragment, Override, Text, Use } from "./syntax";
import { Render } from "./template";
import { join, dirname } from 'path'

class Stack<T> {
    underlying: T[] = []

    push(v: T) {
        this.underlying.push(v)
    }
    pop(): T {
        return this.underlying.pop()
    }
    get top(): T {
        return this.underlying[this.underlying.length - 1]
    }
    get empty(): boolean {
        return this.underlying.length == 0
    }

    foreach(fn: (v: T) => any) {
        for (let i = this.underlying.length - 1; i >= 0; i--) {
            let res = fn(this.underlying[i])
            if (res)
                return res
        }
    }
}

class Scope {
    type: string
    readonly id: string
    readonly prefix: string
    readonly result: string
    private static static_scope_count = 1
    locals = new Set<string>()
    model?: string

    constructor(type: string) {
        this.type = type
        this.id = Scope.static_scope_count.toString()
        this.prefix = `${type}${this.id}_`
        this.result = `result_${type}_${this.id}`
        Scope.static_scope_count += 1
    }

    set(variable: string, prefix = 'local_') {
        this.locals.add(prefix + variable)
        return this.get(variable, prefix)
    }

    get(variable, prefix = 'local_') {
        if (this.locals.has(prefix + variable))
            return this.prefix + prefix + variable
        if (this.model)
            return this.model + '.' + variable
        return undefined
    }
}

class GeneratingContext {
    readonly spec: string

    scopes = new Stack<Scope>()

    constructor(spec: string) {
        this.spec = spec
    }

    get result(): string {
        if (this.scopes.empty)
            return 'result'
        return this.scopes.top.result
    }

    local(name: string) {
        let frags = name.split('.')
        let first = frags.shift()
        let rest = frags.join('.')
        if (rest)
            rest = `.${rest}`
        let local = this.scopes.foreach(scope => scope.get(first))
        if (local)
            return local + rest
        return this.model + "." + name
    }

    builtin(name: string) {
        let frags = name.split('.')
        let first = frags.shift()
        let rest = frags.join('.')
        if (rest)
            rest = `.${rest}`
        let local = this.scopes.foreach(scope => scope.get(first, 'builtin'))
        if (local)
            return local + rest
        return undefined
    }

    get model(): string {
        let model = this.scopes.foreach(scope => scope.model)
        if (model)
            return model
        return 'model'
    }

    helper(name: string) {
        return `engine.helper("${name}")`
    }

    indent(indent: number) {
        if (indent)
            return `.toString().replace(/\\n/g,'\\n'+' '.repeat(${indent}))`
        return '';
    }
}

const generator_table: { [type: string]: (frag: Fragment, ctx: GeneratingContext) => Promise<string> } = {
    text: generateText,
    eval: generateEval,
    call: generateCall,
    block: generateBlock,
    for: generateFor,
    case: generateCase,
    use: generateUse,
    branch: generateBranch,
    extends: generateExtends,
    override: generateOverride,
}

export async function generate(tmpl: Fragment[], spec: string): Promise<Render> {
    const context = new GeneratingContext(spec)
    let code = `let ${context.result}="";`
    for (let frag of tmpl)
        code += await generateFragment(frag, context)
    code += `return ${context.result};`
    return Object.getPrototypeOf(async function () { }).constructor('engine', 'model', 'overrides', code) as Render
}

async function generateFragment(frag: Fragment, ctx: GeneratingContext) {
    return await generator_table[frag.type](frag, ctx)
}
async function generateText(frag: Text, ctx: GeneratingContext) {
    let code = `${ctx.result}+="${frag.text.replace(/("|\\)/g, '\\$1').replace(/\n/g, '\\n')}";`
    return code
}
async function generateEval(frag: Eval, ctx: GeneratingContext) {
    let eva = ''
    if (frag.args) {
        let arg = ctx.local(frag.args)
        let helper = ctx.helper(frag.expr)
        eva = `${helper}(${arg})`
    } else {
        eva = ctx.local(frag.expr)
    }
    if (frag.indent) {
        eva += ctx.indent(frag.indent)
    }
    return `${ctx.result}+=${eva};`
}
async function generateCall(frag: Call, ctx: GeneratingContext) {
    let model = 'model'
    if (frag.model)
        model = ctx.local(frag.model)

    let spec = frag.spec.startsWith('/') ? frag.spec : join(dirname(ctx.spec), frag.spec)
    let code = `(await engine.render("${spec}", ${model}))`
    if (frag.indent) {
        code += ctx.indent(frag.indent)
    }
    return `${ctx.result}+=${code};`
}
async function generateBlock(frag: Block, ctx: GeneratingContext) {
    let code = `if(overrides && "${frag.name}" in overrides)${ctx.result}+=overrides.${frag.name}${ctx.indent(frag.indent)};`
    if (frag.content.length) {
        let here = new Scope('block')
        let r = here.result
        if (frag.trimStart) r += `.trimStart()`
        if (frag.trimEnd) r += `.trimEnd()`

        let c = '';
        ctx.scopes.push(here)
        for (let f of frag.content)
            c += await generateFragment(f, ctx)
        ctx.scopes.pop()

        code += `else{let ${here.result}="";${c}${ctx.result}+=${r};}`
    }
    return code
}
async function generateUse(frag: Use, ctx: GeneratingContext) {
    let here = new Scope('use')
    here.model = ctx.local(frag.expr)
    let r = here.result
    if (frag.trimStart) r += `.trimStart()`
    if (frag.trimEnd) r += `.trimEnd()`

    let c = '';
    ctx.scopes.push(here)
    for (let f of frag.content)
        c += await generateFragment(f, ctx)
    ctx.scopes.pop()

    return `let ${here.result}="";${c}${ctx.result}+=${r};`
}
async function generateFor(frag: For, ctx: GeneratingContext) {
    let expr = ctx.local(frag.expr)

    let here = new Scope('for')
    let i = here.set('i', 'builtin')
    let keys = here.set('keys', 'builtin')
    let value = here.set(frag.value)
    let key = frag.key
        ? here.set(frag.key)
        : here.set('k', 'builtin')

    let c = '';
    ctx.scopes.push(here)
    for (let f of frag.content)
        c += await generateFragment(f, ctx)
    ctx.scopes.pop()

    let r = here.result
    if (frag.trimStart) r += `.trimStart()`
    if (frag.trimEnd) r += `.trimEnd()`

    let code = `let ${keys}=Object.keys(${expr});`
        + `for(let ${i}=0;${i}<${keys}.length;${i}++){`
        + `let ${key}=${keys}[${i}];let ${value}=${expr}[${key}];`
        + `let ${here.result}="";${c}${ctx.result}+=${r};}`
    return code
}
async function generateCase(frag: Case, ctx: GeneratingContext) {
    let c = '';
    let here = new Scope('case')
    ctx.scopes.push(here)
    for (let f of frag.content)
        c += await generateFragment(f, ctx)
    ctx.scopes.pop()

    let r = here.result
    if (frag.trimStart) r += `.trimStart()`
    if (frag.trimEnd) r += `.trimEnd()`

    let i = ctx.builtin('i')
    let keys = ctx.builtin('keys')

    let code = `let ${here.result}="";${c}${ctx.result}+=${r};`
    switch (frag.case) {
        case 'first': return `if(${i}==0){${code}}`
        case 'last': return `if(${i}==${keys}.length-1){${code}}`
        case 'non-first': return `if(${i}>0){${code}}`
        case 'non-last': return `if(${i}<${keys}.length-1){${code}}`
    }
}
async function generateBranch(frag: Branch, ctx: GeneratingContext) {
    let cond = ctx.local(frag.cond)

    let here = new Scope('branch')

    let code_true = `let ${here.result}="";`
    let code_false = `let ${here.result}="";`
    ctx.scopes.push(here)
    for (let f of frag.if)
        code_true += await generateFragment(f, ctx)
    for (let f of frag.else)
        code_false += await generateFragment(f, ctx)
    ctx.scopes.pop()

    let rt = here.result
    if (frag.trimIfStart) rt += `.trimStart()`
    if (frag.trimIfEnd) rt += `.trimEnd()`
    let rf = here.result
    if (frag.trimElseStart) rf += `.trimStart()`
    if (frag.trimElseEnd) rf += `.trimEnd()`

    let code = `if(${cond}){${code_true}${ctx.result}+=${rt};}`
    if (frag.else.length)
        code += `else{${code_false}${ctx.result}+=${rf};}`
    return code
}
async function generateExtends(frag: Extends, ctx: GeneratingContext) {
    let code = 'if(!overrides) overrides = {};'
    for (let f of frag.content)
        code += await generateFragment(f, ctx)
    let spec = frag.spec.startsWith('/') ? frag.spec : join(dirname(ctx.spec), frag.spec)
    code += `${ctx.result}=(await(await engine.compile("${spec}")).render(engine, model, overrides));`
    return code
}
async function generateOverride(frag: Override, ctx: GeneratingContext) {
    let here = new Scope('override')
    let r = here.result
    if (frag.trimStart) r += `.trimStart()`
    if (frag.trimEnd) r += `.trimEnd()`

    let c = '';
    ctx.scopes.push(here)
    for (let f of frag.content)
        c += await generateFragment(f, ctx)
    ctx.scopes.pop()

    return `let ${here.result}="";` +
        `${c}if(!("${frag.name}" in overrides))overrides["${frag.name}"]="";` +
        `overrides["${frag.name}"]+=${r};`
}