type SvgAttributeValue = boolean | number | string | null | undefined
type SvgAttributes = Record<string, SvgAttributeValue>

export class SvgBuilder {
  private readonly tagName: string
  private readonly attributes: SvgAttributes
  private readonly children: string[] = []

  constructor(tagName: string, attributes: SvgAttributes = {}) {
    this.tagName = tagName
    this.attributes = attributes
  }

  child(tagName: string, attributes: SvgAttributes = {}, text?: string): this {
    this.children.push(formatChildElement(tagName, attributes, text))
    return this
  }

  childElement(element: SvgBuilder): this {
    this.children.push(element.build())
    return this
  }

  build(): string {
    return formatElement(this.tagName, this.attributes, this.children, true)
  }
}

function formatChildElement(tagName: string, attributes: SvgAttributes, text?: string): string {
  if (text !== undefined) {
    return `<${tagName}${formatAttributes(attributes)}>${escapeText(text)}</${tagName}>`
  }

  return formatElement(tagName, attributes, [], false)
}

function formatElement(
  tagName: string,
  attributes: SvgAttributes,
  children: string[],
  forceExpanded: boolean,
): string {
  const openTag = `<${tagName}${formatAttributes(attributes)}`

  if (children.length === 0 && !forceExpanded) {
    return `${openTag} />`
  }

  return [`${openTag}>`, ...children.map(indent), `</${tagName}>`].join('\n')
}

function indent(value: string): string {
  return `  ${value.replaceAll('\n', '\n  ')}`
}

function formatAttributes(attributes: SvgAttributes): string {
  return Object.entries(attributes)
    .filter(([, value]) => value !== null && value !== undefined && value !== false)
    .map(([name, value]) => {
      if (value === true) {
        return ` ${name}`
      }

      return ` ${name}="${escapeAttribute(String(value))}"`
    })
    .join('')
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
