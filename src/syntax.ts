export const reg_table = {
    eval: /\{\{\s*((?:\w|_|\.)+)(?:\s+((?:\w|_|\.)+))?\s*-?\}\}/,
    call: /\{\{#call\s+((?:\w|\d|\/|\.|-|_)+)(?:\s+with\s+((?:\w|_|\.)+))?\s*-?\}\}/,
    extends: /\{\{#extends\s+((?:\w|\d|\/|\.|-|_)+)\s*\}\}/,
    block: /\{\{#block\s+(\w+)\s*-?\/?\}\}/,
    for: /\{\{#for\s+(\w+)\s*(?:,\s*(\w+))?\s+in\s+((?:\w|_|\.)+)\s*-?\}\}/,
    case: /\{\{#(first|last|non-first|non-last)\s*-?\}\}/,
    use: /\{\{#use\s+((?:\w|_|\.)+)\s*-?\}\}/,
    override: /\{\{#override\s+(\w+)\s*-?\}\}/,
    branch: /\{\{#if\s+((?:\w|_|\.)+)\s*-?\}\}/,
    else: /\{\{#-?else\s*-?\}\}/,
    endblock: /\{\{\/-?block\s*\}\}/,
    endfor: /\{{\/-?for\s*\}\}/,
    endcase: /\{\{\/-?(first|last|non-first|non-last)\s*\}\}/,
    enduse: /\{\{\/-?use\s*\}\}/,
    endoverride: /\{\{\/-?override\s*\}\}/,
    endbranch: /\{\{\/-?if\s*\}\}/
}


/** 纯文本 */
export interface Text {
    type: 'text'

    /** 文本内容 */
    text: string
}

/** 
 * 演算
 * 
 * ```
 * {{ expr }}
 * {{ helper arg }}
 * ```
 */
export interface Eval {

    type: 'eval'
    /** 
     * 表达式
     * 
     * 先搜索模型再搜索Helper函数
     * 
     * 支持名称引用，若最后结果为函数则尝试调用
     * 
     * ```js
     * object.value
     * object.func
     * ```
     * 
     * 若第一表达式之后有后续表达式
     * 后续表达式被演算后作为参数传入第一表达式，仅支持一个参数
     * 
     * ```js
     * helper arg
     * ```
     */
    expr: string

    /** 可选的参数 */
    args?: string

    /** 缩进，除首行外补齐缩进，若处于抑制上下文则忽略 */
    indent: number
}

/** 
 * 调用其它模板
 * 
 * ```
 * {{#call spec }}
 * {{#call spec with model }}
 * ```
 */
export interface Call {

    type: 'call'

    /** 模板路径 */
    spec: string

    /** 可选的基准模型 */
    model?: string

    /** 除首行外，自动缩进 */
    indent: number
}

/** 继承模板 */
export interface Extends {
    type: 'extends'

    /** 模板路径 */
    spec: string

    /** 实现内容 */
    content: Override[]
}

/** 定义一个块 */
export interface Block {
    type: 'block'

    /** 块名称 */
    name: string

    /** 除首行外自动缩进 */
    indent: number

    /** 默认内容 */
    content: Fragment[]

    /** 剔除起始空白 */
    trimStart: boolean

    /** 剔除结束空白 */
    trimEnd: boolean
}

/** 
 * 迭代
 * 
 * ```
 * {{#for value, key in expr}}
 * 
 * {{/for}}
 * 
 * {{#for value in expr}}
 * 
 * {{/for}}
 * ```
 */
export interface For {

    type: 'for'

    /** 被迭代的容器对象或数组均可，若模拟结果为函数则调用 */
    expr: string

    /** 迭代时值的变量名 */
    value: string

    /** 迭代时，键的变量名 */
    key?: string

    /** 迭代生产内容 */
    content: Fragment[]

    /** 剔除起始空白 */
    trimStart: boolean

    /** 剔除结束空白 */
    trimEnd: boolean
}

/** 循环时点捕捉器 */
export interface Case {
    type: 'case'

    /** 时机 */
    case: 'first' | 'last' | 'non-first' | 'non-last'

    /** 实现内容 */
    content: Fragment[]

    /** 剔除起始空白 */
    trimStart: boolean

    /** 剔除结束空白 */
    trimEnd: boolean

}

/** 
 * 
 * 切换基准模型 
 *
 * {{#use expr}}
 * 
 * {{/use}}
 */
export interface Use {

    type: 'use'

    /** 表达式，若模拟值为函数则调用 */
    expr: string

    /** 块内容 */
    content: Fragment[]

    /** 剔除起始空白 */
    trimStart: boolean

    /** 剔除结束空白 */
    trimEnd: boolean
}

/** 实现一个块 */
export interface Override {
    type: 'override'

    /** 实现的块的名称 */
    name: string

    /** 实现内容 */
    content: Fragment[]

    /** 剔除起始空白 */
    trimStart: boolean

    /** 剔除结束空白 */
    trimEnd: boolean
}

export interface Branch {
    type: 'branch'

    /** 条件表达式 */
    cond: string

    /** 成立分支 */
    if: Fragment[]

    /** 不成立分支 */
    else: Fragment[]

    /** 剔除起始空白 */
    trimIfStart: boolean

    /** 剔除结束空白 */
    trimIfEnd: boolean

    /** 剔除起始空白 */
    trimElseStart: boolean

    /** 剔除结束空白 */
    trimElseEnd: boolean
}

export type Fragment = Eval | For | Call | Use | Text | Extends | Override | Block | Branch | Case

export interface Token {
    type?: 'text' | keyof typeof reg_table
    source: string
    line: number
    column: number
    text: string
}