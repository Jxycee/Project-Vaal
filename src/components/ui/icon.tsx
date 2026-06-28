import { cn } from '@/lib/utils'

/**
 * Renders one of the masked UI icons from /public/icons/<name>.png.
 * Colour comes from the text colour (set e.g. text-primary), size from
 * a size-* utility. The PNG is used purely as an alpha mask.
 */
export function Icon({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const url = `url(/icons/${name}.png)`
  return (
    <span
      aria-hidden="true"
      className={cn('vaal-icon', className)}
      style={{ WebkitMaskImage: url, maskImage: url }}
    />
  )
}
