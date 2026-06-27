const { chromium } = require('playwright');
const PptxGenJS = require('pptxgenjs');
const fs = require('fs');
const path = require('path');

const TOTAL_SLIDES = 10;
const OUT_DIR = path.join(__dirname, 'deck-output');
const PPTX_PATH = path.join(__dirname, 'Sean-Walsh-Listing-Presentation.pptx');
const HTML_FILE = `file://${path.join(__dirname, 'listing-presentation.html')}`;

async function captureSlides() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const paths = [];

  for (let i = 0; i < TOTAL_SLIDES; i++) {
    // Fresh page per slide — eliminates all transition / state bleed between captures
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto(HTML_FILE, { waitUntil: 'load' });

    // Kill every transition and animation so slides are instantly visible
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
    });

    // Activate exactly this slide, force opacity via inline style, hide chrome
    await page.evaluate((idx) => {
      document.querySelectorAll('.slide').forEach((s, j) => {
        if (j === idx) {
          s.classList.add('active');
          s.style.opacity = '1';
          s.style.pointerEvents = 'all';
        } else {
          s.classList.remove('active');
          s.style.opacity = '0';
          s.style.pointerEvents = 'none';
        }
      });
      const nav = document.getElementById('nav');
      if (nav) nav.style.display = 'none';
      const hint = document.querySelector('.key-hint');
      if (hint) hint.style.display = 'none';
    }, i);

    // Let the browser paint and Google Fonts settle
    await page.waitForTimeout(1200);

    const imgPath = path.join(OUT_DIR, `slide-${String(i + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: imgPath, type: 'png' });
    paths.push(imgPath);
    console.log(`  Captured slide ${i + 1} / ${TOTAL_SLIDES}`);

    await page.close();
  }

  await browser.close();
  return paths;
}

async function buildPptx(imagePaths) {
  const pptx = new PptxGenJS();

  pptx.layout = 'LAYOUT_WIDE'; // 13.33" × 7.5" (16:9)
  pptx.title   = 'Sean Walsh | Cush Real Estate | Listing Presentation';
  pptx.subject = "Maximizing Your Home's Value Through Strategic Design";
  pptx.author  = 'Sean Walsh, Cush Real Estate By Design';

  for (const imgPath of imagePaths) {
    const slide = pptx.addSlide();
    slide.addImage({ path: imgPath, x: 0, y: 0, w: '100%', h: '100%' });
  }

  await pptx.writeFile({ fileName: PPTX_PATH });
  console.log(`\n  PPTX saved → ${PPTX_PATH}`);
}

(async () => {
  console.log('\nCapturing slides...');
  const paths = await captureSlides();

  console.log('\nBuilding PPTX...');
  await buildPptx(paths);

  // Clean up screenshots
  paths.forEach(p => fs.unlinkSync(p));
  fs.rmdirSync(OUT_DIR);

  console.log('Done.\n');
})();
