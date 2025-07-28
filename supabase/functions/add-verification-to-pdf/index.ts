import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { PDFDocument, rgb, StandardFonts } from 'https://cdn.skypack.dev/pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Get JWT token from Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('PDF modification function started');
    
    const formData = await req.formData()
    const pdfFile = formData.get('pdf') as File
    const verificationId = formData.get('verificationId') as string

    console.log('Received PDF file:', pdfFile?.name, 'size:', pdfFile?.size);
    console.log('Verification ID:', verificationId);

    if (!pdfFile || !verificationId) {
      throw new Error('PDF file and verification ID are required')
    }

    // Read the PDF file
    const pdfBytes = await pdfFile.arrayBuffer()
    console.log('PDF bytes loaded, size:', pdfBytes.byteLength);
    
    const pdfDoc = await PDFDocument.load(pdfBytes)
    console.log('PDF document loaded successfully');

    // Get the first page to add the verification ID
    const pages = pdfDoc.getPages()
    const firstPage = pages[0]
    const { width, height } = firstPage.getSize()

    // Embed the Helvetica font
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

    // Add verification ID as watermark in top-right corner
    firstPage.drawText(`Verification ID: ${verificationId}`, {
      x: width - 250,
      y: height - 30,
      size: 10,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    })

    // Add verification ID as footer watermark
    firstPage.drawText(`Document Verification ID: ${verificationId}`, {
      x: 50,
      y: 30,
      size: 8,
      font: helveticaFont,
      color: rgb(0.7, 0.7, 0.7),
    })



    // Save the PDF
    const modifiedPdfBytes = await pdfDoc.save()
    console.log('PDF modified successfully, output size:', modifiedPdfBytes.byteLength);

    return new Response(modifiedPdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="verified_transcript_${verificationId}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error modifying PDF:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})