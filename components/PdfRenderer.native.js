import React from 'react';
import Pdf from 'react-native-pdf';

/**
 * PdfRenderer -- native implementation.
 *
 * Metro/Expo resolve `.native.js` for iOS and Android (never for web --
 * see PdfRenderer.web.js, the sibling file web resolves to instead).
 * This keeps `react-native-pdf` -- a native-only library with no web
 * implementation -- out of the web bundle entirely: web's Metro resolver
 * never even considers this file, so it never tries to import
 * react-native-pdf in the first place. See PDFViewScreen.js for why the
 * screen imports `../components/PdfRenderer` with no platform suffix
 * and lets Metro pick this file or the .web.js one automatically.
 *
 * A thin, faithful pass-through of react-native-pdf's own props -- no
 * behavior change from what PDFViewScreen.js used directly before this
 * split.
 */
const PdfRenderer = React.forwardRef((props, ref) => <Pdf ref={ref} {...props} />);

PdfRenderer.displayName = 'PdfRenderer';

export default PdfRenderer;
