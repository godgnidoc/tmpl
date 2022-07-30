import { Fragment } from "./syntax"

export type Helper = (arg: any) => any

export type Render = (te: TemplateEngine, model: any) => Promise<string>

export interface Template {
    spec: string
    source: string
    tmpl: Fragment[]
    render: Render
}
export interface TemplateEngine {
    render(spec: string, model: any): Promise<string>
    compile(spec: string): Promise<Template>
    helper(spec: string, fn: Helper): Helper
}