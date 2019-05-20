const locations = [
    { x: 0, y: 0 },
    { x: 16, y: 0 },
    { x: 32, y: 0 },
    { x: 0, y: 16 },
    { x: 0, y: 16 },
    { x: 16, y: 16 },
    { x: 32, y: 16 },
    { x: 33, y: 16 },
    { x: 33, y: 16 },
    { x: 32, y: 17 }
]

const w: number = 16
const h: number = 16

const isNeigbor = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number,
    height: number
): boolean => {
    if (x1 >= x2 && y1 >= y2)
        return false
    if (x2 - x1 < width && y2 - y1 < height)
        return true
    return false
}

const result = locations
    .filter((loc1) => locations
        .filter((loc2) => isNeigbor(loc2.x, loc2.y, loc1.x, loc1.y, w, h))
        .length === 0)

// console.log(isNeigbor(0, 0, 10, 0, 10, 10))
console.log({ locations, result })