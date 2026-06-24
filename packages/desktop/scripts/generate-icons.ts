import sharp from "sharp"
import { $ } from "bun"
import fs from "fs"
import path from "path"

const svgPath = "./icons/mimocode-icon.svg"
const channels = ["dev", "beta", "prod"]

// macOS icon sizes
const macSizes = [16, 32, 64, 128, 256, 512, 1024]
// Windows icon sizes
const winSizes = [16, 32, 48, 256]
// Linux / general sizes
const linuxSizes = [16, 32, 48, 64, 128, 256, 512, 1024]
// Store logo
const storeSizes = [30, 44, 71, 89, 107, 142, 150, 284, 310]

async function generateIcons() {
  const svgBuffer = await fs.promises.readFile(svgPath)
  
  for (const channel of channels) {
    const outDir = `./icons/${channel}`
    await $`mkdir -p ${outDir}`
    
    // Generate macOS PNGs (for iconset)
    const iconsetDir = `${outDir}/icon.iconset`
    await $`mkdir -p ${iconsetDir}`
    
    for (const size of macSizes) {
      const filename = size === 1024 
        ? `icon_512x512@2x.png` 
        : `icon_${size}x${size}.png`
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(`${iconsetDir}/${filename}`)
      
      // Also save as standalone for other uses
      if (size <= 128) {
        await sharp(svgBuffer)
          .resize(size, size)
          .png()
          .toFile(`${outDir}/${size}x${size}.png`)
      }
      if (size === 128) {
        await sharp(svgBuffer)
          .resize(size * 2, size * 2)
          .png()
          .toFile(`${outDir}/${size}x${size}@2x.png`)
      }
    }
    
    // Generate macOS icns
    try {
      await $`iconutil -c icns ${iconsetDir} -o ${outDir}/icon.icns`
    } catch {
      console.log("iconutil failed, using alternative method")
    }
    
    // Generate Windows ico
    // sharp doesn't support ico directly, so we'll generate PNGs
    for (const size of winSizes) {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(`${outDir}/${size}x${size}.png`)
    }
    
    // Generate store logos
    for (const size of storeSizes) {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(`${outDir}/Square${size}x${size}Logo.png`)
    }
    
    // Generate dock icon (1024x1024)
    await sharp(svgBuffer)
      .resize(1024, 1024)
      .png()
      .toFile(`${outDir}/dock.png`)
    
    // Generate icon.png (512x512)
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile(`${outDir}/icon.png`)
    
    // Clean up iconset
    await $`rm -rf ${iconsetDir}`
    
    console.log(`Generated icons for ${channel}`)
  }
  
  // Copy dev icons to resources/icons
  await $`rm -rf resources/icons`
  await $`cp -R icons/dev resources/icons`
  
  console.log("Done! Icons copied to resources/icons")
}

generateIcons().catch(console.error)
