import { TemplateEngine as TE, Template, Helper } from "./template"
import parse from "./parse"
import scan from "./scan"
import { generate } from "./render"
import { readFile } from 'fs/promises'
import { join } from 'path'

export class TemplateEngine implements TE {
    private root: string
    private cache: { [spec: string]: Template } = {}
    private helpers: { [spec: string]: Helper } = {}

    constructor(root: string) {
        this.root = root
        this.built_in_helpers()
    }

    public async render(spec: string, model: any) {
        let T = await this.compile(spec)
        return await T.render(this, model)
    }

    public async compile(spec: string): Promise<Template> {
        if (!spec.endsWith('.tmpl'))
            spec += '.tmpl'
        if (spec in this.cache)
            return this.cache[spec]

        let source = (await readFile(join(this.root, spec))).toString()

        let tokens = scan(source, spec, '<!>')
        let tmpl = parse(tokens)
        let render = await generate(tmpl, spec)

        let T = { spec, source, tmpl, render }
        return this.cache[spec] = T
    }

    public helper(spec: string, fn: Helper): Helper {
        if (fn)
            this.helpers[spec] = fn
        return this.helpers[spec]
    }

    private built_in_helpers() {
        this.helper("lowercase", (s: string) => s.toLowerCase())
        this.helper("uppercase", (s: string) => s.toUpperCase())
    }
}