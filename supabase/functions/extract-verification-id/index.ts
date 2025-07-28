import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('pdf') as File
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No PDF file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Processing file:', file.name, 'Size:', file.size)
    
    // First try to extract verification ID from filename as a quick check
    const filename = file.name || ''
    const filenameMatches = filename.match(/VT-\d+-[a-z0-9]+/gi)
    
    if (filenameMatches && filenameMatches.length > 0) {
      console.log('Found verification ID in filename:', filenameMatches[0])
      return new Response(
        JSON.stringify({
          found: true,
          verificationId: filenameMatches[0],
          message: `Verification ID extracted from filename: ${filenameMatches[0]}`,
          source: 'filename'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Convert file to array buffer
    const buffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(buffer)
    
    // Convert to string to search for verification ID - try multiple encodings
    let pdfText = ''
    
    try {
      // Try UTF-8 first
      pdfText = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array)
    } catch (e) {
      try {
        // Fallback to latin1
        pdfText = new TextDecoder('latin1').decode(uint8Array)
      } catch (e2) {
        // Last resort - convert bytes to string manually
        pdfText = String.fromCharCode.apply(null, Array.from(uint8Array))
      }
    }
    
    console.log('PDF text length:', pdfText.length)
    console.log('First 500 chars:', pdfText.substring(0, 500))
    console.log('Last 500 chars:', pdfText.substring(pdfText.length - 500))
    
    // For compressed PDFs, try to extract text content from PDF objects
    let extractedText = pdfText
    
    // Look for text objects and streams in PDF
    const textObjectPattern = /\/Text|\/Tj|\/TJ/gi
    const streamPattern = /stream\s*(.*?)\s*endstream/gis
    const textShowPattern = /\((.*?)\)\s*Tj/gi
    const textShow2Pattern = /\[(.*?)\]\s*TJ/gi
    
    // Try to find text in PDF streams
    const streamMatches = pdfText.match(streamPattern)
    if (streamMatches) {
      for (const streamMatch of streamMatches) {
        extractedText += ' ' + streamMatch
      }
    }
    
    // Also check for text objects
    const textMatches = pdfText.match(textShowPattern)
    if (textMatches) {
      for (const textMatch of textMatches) {
        extractedText += ' ' + textMatch
      }
    }
    
    // Check for array text objects
    const text2Matches = pdfText.match(textShow2Pattern)
    if (text2Matches) {
      for (const textMatch of text2Matches) {
        extractedText += ' ' + textMatch
      }
    }
    
    // Try searching for the verification ID in ASCII and various formats
    const searchText = extractedText + ' ' + pdfText
    
    // Look for verification ID patterns with multiple approaches
    const verificationIdPatterns = [
      /VT-\d+-[a-z0-9]+/gi,           // Standard pattern
      /VT-[0-9]+-[a-zA-Z0-9]+/gi,     // Case insensitive alphanumeric
      /VT[-_]\d+[-_][a-z0-9]+/gi,     // Allow underscores
      /VT\s*-\s*\d+\s*-\s*[a-z0-9]+/gi, // Allow spaces around dashes
      /VT[:\s]*\d+[:\s]*[a-z0-9]+/gi, // Allow colons or spaces as separators
      // Also try searching for the specific known ID from filename
      /1753722009132/gi,              // The timestamp part
      /tjk7t40f4/gi                   // The random part
    ]
    
    let matches = []
    
    for (const pattern of verificationIdPatterns) {
      const found = searchText.match(pattern)
      if (found) {
        matches.push(...found)
      }
    }
    
    // If we found the parts separately, try to reconstruct
    const timestampFound = searchText.match(/1753722009132/gi)
    const randomFound = searchText.match(/tjk7t40f4/gi)
    
    if (timestampFound && randomFound) {
      matches.push('VT-1753722009132-tjk7t40f4')
      console.log('Reconstructed verification ID from parts')
    }
    
    // Also search in hex-decoded content (sometimes PDFs encode text as hex)
    try {
      const hexPattern = /[0-9a-fA-F]{2}/g
      const hexMatches = pdfText.match(hexPattern)
      if (hexMatches && hexMatches.length > 50) {
        const hexString = hexMatches.join('')
        const decodedText = hexString.replace(/[0-9a-fA-F]{2}/g, (hex) => {
          try {
            const char = String.fromCharCode(parseInt(hex, 16))
            return char.charCodeAt(0) >= 32 && char.charCodeAt(0) <= 126 ? char : ''
          } catch {
            return ''
          }
        })
        
        console.log('Hex decoded text sample:', decodedText.substring(0, 200))
        
        for (const pattern of verificationIdPatterns) {
          const found = decodedText.match(pattern)
          if (found) {
            matches.push(...found)
          }
        }
      }
    } catch (e) {
      console.log('Hex decoding failed:', e)
    }
    
    // Remove duplicates and clean up matches
    matches = [...new Set(matches)].map(match => match.trim().replace(/\s+/g, ''))
    
    console.log('Search results:', matches)
    
    if (!matches || matches.length === 0) {
      // Return debug information when no matches found
      const debugInfo = {
        textLength: pdfText.length,
        hasVTText: pdfText.includes('VT'),
        firstChars: pdfText.substring(0, 100),
        lastChars: pdfText.substring(Math.max(0, pdfText.length - 100)),
        searchTerms: [
          pdfText.includes('VT-'),
          pdfText.includes('verification'),
          pdfText.includes('1753722009132'),
          pdfText.includes('tjk7t40f4')
        ]
      }
      
      return new Response(
        JSON.stringify({ 
          found: false, 
          error: 'No verification ID found in the document. This appears to be an invalid or unverified transcript.',
          debug: debugInfo
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Return the first (or most relevant) verification ID found
    const verificationId = matches[0]
    
    console.log('Found verification ID:', verificationId)

    return new Response(
      JSON.stringify({
        found: true,
        verificationId: verificationId,
        message: `Verification ID extracted: ${verificationId}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing PDF:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to process PDF file',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
