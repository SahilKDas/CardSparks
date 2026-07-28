export function roundHalfEven(value) {
  const floor = Math.floor(value)
  const diff = value - floor
  if (diff !== 0.5) return Math.round(value)
  return floor % 2 === 0 ? floor : floor + 1
}