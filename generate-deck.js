const { chromium } = require('playwright');
const PptxGenJS = require('pptxgenjs');
const fs = require('fs');
const path = require('path');

const TOTAL_SLIDES = 10;
const OUT_DIR = path.join(__dirname, 'deck-output');
const PPTX_PATH = path.join(__dirname, 'Sean-Walsh-Listing-Presentation.pptx');
const HTML_FILE = `file://${path.join(__dirname, 'listing-presentation-print.html')}`;

async function captureSlides() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const paths = [];

  for (let i = 0; i < TOTAL_SLIDES; i++) {
    // Fresh page per slide — eliminates all state bleed
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto(HTML_FILE, { waitUntil: 'load' });

    // Activate this slide, hide others
    await page.evaluate((idx) => {
      const slides = document.querySelectorAll('.slide');
      slides.forEach((s, j) => {
        if (j === idx) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
          s.style.display = 'none';
        }
      });
    }, i);

    // Wait for fonts + paint
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Screenshot the slide element directly (not the viewport) for exact 1920x1080
    const slideHandle = await page.$(`#s${i + 1}`);
    const imgPath = path.join(OUT_DIR, `slide-${String(i + 1).padStart(2, '0')}.png`);
    await slideHandle.screenshot({ path: imgPath, type: 'png' });
    paths.push(imgPath);

    const stat = fs.statSync(imgPath);
    console.log(`  Slide ${i + 1}: ${imgPath} (${Math.round(stat.size / 1024)} KB)`);

    await page.close();
  }

  await browser.close();
  return paths;
}

async function buildPptx(imagePaths) {
  const pptx = new PptxGenJS();

  pptx.layout = 'LAYOUT_WIDE'; // 13.33" × 7.5" (16:9)
  pptx.title = 'Sean Walsh | Cush Real Estate | Listing Presentation';
  pptx.subject = "Maximizing Your Home's Value Through Strategic Design";
  pptx.author = 'Sean Walsh, Cush Real Estate By Design';

  for (const imgPath of imagePaths) {
    const slide = pptx.addSlide();
    slide.addImage({ path: imgPath, x: 0, y: 0, w: '100%', h: '100%' });
  }

  await pptx.writeFile({ fileName: PPTX_PATH });
  console.log(`\n  PPTX saved → ${PPTX_PATH}`);
}

(async () => {
  console.log('\nCapturing slides at 1920×1080...');
  const paths = await captureSlides();

  console.log('\nBuilding PPTX...');
  await buildPptx(paths);

  console.log('Done.\n');
})();
