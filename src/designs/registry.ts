/**
 * Design variants are discovered from src/designs/<id>/{meta.json,style.css}.
 * Each style.css must scope every rule under [data-design="<id>"] so all designs can be
 * bundled together and switched at runtime by setting <html data-design="…">.
 */
export interface DesignMeta {
  id: string
  name: string
  description: string
  order: number
  swatch: string[]
  /** Font stylesheet URLs (Google Fonts / jsDelivr); loaded only while the design is active. */
  fonts: string[]
}

const metas = import.meta.glob<DesignMeta>('./*/meta.json', { eager: true, import: 'default' })
import.meta.glob('./*/style.css', { eager: true })

export const DESIGNS: DesignMeta[] = Object.values(metas).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
/** Lowest `order` wins: the design ranked first by the judge panel. */
export const DEFAULT_DESIGN = DESIGNS[0]?.id ?? 'reader'
