import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBlockchainAuth } from "@/hooks/useBlockchainAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ResponsiveNavbar } from "@/components/ResponsiveNavbar";
import { 
  Shield, 
  Upload, 
  Search, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  FileText,
  Hash,
  Calendar,
  Building,
  User,
  ExternalLink,
  Download,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VerificationResult {
  status: "verified" | "pending" | "invalid" | "rate_limited" | "limit_exceeded";
  verificationId?: string;
  studentName?: string;
  institution?: string;
  issueDate?: string;
  createdDate?: string;
  blockchainTx?: string;
  fileHash?: string;
  transcriptId?: string;
  message?: string;
  verificationCount?: number;
  verificationLimit?: number;
  remainingVerifications?: number;
}

const VerifyTranscript = () => {
  const [verificationId, setVerificationId] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { verifyDocument, isBlockchainEnabled } = useBlockchainAuth();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  // Validate verification ID format
  const validateVerificationId = (id: string): { isValid: boolean; error?: string } => {
    if (!id || id.trim().length === 0) {
      return { isValid: false, error: "Verification ID is required" };
    }
    
    const trimmedId = id.trim();
    
    // Check for basic format: VT-timestamp-random
    const verificationIdRegex = /^VT-\d+-[a-z0-9]+$/i;
    if (!verificationIdRegex.test(trimmedId)) {
      return { 
        isValid: false, 
        error: "Verification ID must be in the format VT-XXXXXXXXX-XXXXXXX" 
      };
    }
    
    return { isValid: true };
  };

  const verifyById = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!verificationId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a verification ID",
        variant: "destructive",
      });
      return;
    }

    // Validate verification ID format
    const validation = validateVerificationId(verificationId);
    if (!validation.isValid) {
      toast({
        title: "Invalid Format",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setVerificationResult(null);
    
    try {
      // Use blockchain verification if available
      const blockchainResult = await verifyDocument({
        action: 'verify_id',
        verificationId: verificationId.trim()
      });

      if (blockchainResult && blockchainResult.valid) {
        setVerificationResult({
          status: "verified",
          verificationId: verificationId.trim(),
          studentName: blockchainResult.metadata?.studentName,
          institution: blockchainResult.metadata?.institution,
          issueDate: blockchainResult.metadata?.issueDate,
          blockchainTx: blockchainResult.metadata?.blockchainTx,
          fileHash: blockchainResult.documentHash,
          message: isBlockchainEnabled ? "Document verified on blockchain" : "Document verified"
        });
      } else {
        // Fallback to verification with limit checking (no auth required)
        let result = null;
        let error = null;
        
        try {
          const response = await fetch('https://nohrizhxwrsinsyyojju.supabase.co/functions/v1/verify-with-limit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              verificationId: verificationId.trim(),
              ipAddress: 'unknown', // Skip IP fetch due to CSP restrictions
              userAgent: navigator.userAgent
            })
          });
          
          if (response.ok) {
            result = await response.json();
          } else {
            const errorText = await response.text();
            error = { message: errorText, status: response.status };
          }
          
          // If there's an error but the status is 429, it might be a limit exceeded error
          if (error && error.context?.status === 429) {
            // Try to parse the error response to get limit information
            try {
              const errorResponse = await error.context.json();
              if (errorResponse.limitExceeded) {
                result = errorResponse;
                error = null; // Clear the error so we handle it as a limit exceeded case
              }
            } catch (parseError) {
              console.log('Could not parse 429 response:', parseError);
            }
          }
        } catch (invokeError) {
          console.error('Function invoke error:', invokeError);
          error = invokeError;
        }

        if (error) {
          console.error('Verification error:', error);
          
          setVerificationResult({
            status: "invalid",
            message: error.message || "Verification ID not found"
          });
          toast({
            title: "Verification Failed",
            description: error.message || "Invalid verification ID",
            variant: "destructive",
          });
        } else if (result) {
          if (result.limitExceeded) {
            setVerificationResult({
              status: "limit_exceeded",
              message: "Sorry, you have exceeded your limit to verify your transcript. Contact your institution to reactivate.",
              verificationCount: result.verificationCount,
              verificationLimit: result.verificationLimit
            });
            toast({
              title: "❌ Verification Limit Exceeded",
              description: "Sorry, you have exceeded your limit to verify your transcript. Contact your institution to reactivate.",
              variant: "destructive",
            });
          } else if (result.verified) {
            setVerificationResult({
              status: "verified",
              verificationId: verificationId.trim(),
              studentName: result.student?.name,
              institution: result.institution?.name,
              issueDate: result.transcript?.issuedAt,
              blockchainTx: result.transcript?.blockchainTx,
              fileHash: result.transcript?.fileHash,
              message: "Transcript is verified and authentic",
              verificationCount: result.verificationCount,
              verificationLimit: result.verificationLimit,
              remainingVerifications: result.remainingVerifications
            });
            
            toast({
              title: "✅ Verified!",
              description: `Transcript verified! ${result.remainingVerifications} verifications remaining.`,
            });
          } else {
            setVerificationResult({
              status: "invalid",
              message: result.error || "Verification ID not found"
            });
            toast({
              title: "❌ Invalid",
              description: result.error || "Verification ID not found or invalid",
              variant: "destructive",
            });
          }
        }
      }
      
      // Show success toast for blockchain verification
      if (blockchainResult && blockchainResult.valid) {
        toast({
          title: "✅ Verified!",
          description: isBlockchainEnabled ? "Document verified on blockchain" : "Document verified and authentic",
        });
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      setVerificationResult({
        status: "invalid",
        message: "Failed to verify transcript. Please try again."
      });
      toast({
        title: "Verification Error",
        description: "Failed to verify transcript. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyByFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile) return;
    
    setIsLoading(true);
    setVerificationResult(null);
    
    try {
      console.log('Starting file verification for:', uploadedFile.name);
      
      // Step 1: Extract verification ID from the uploaded PDF
      const formData = new FormData();
      formData.append('pdf', uploadedFile);
      
      // Extract verification ID from PDF (no authentication required)
      const extractResponse = await fetch('https://nohrizhxwrsinsyyojju.supabase.co/functions/v1/extract-verification-id', {
        method: 'POST',
        body: formData,
      });

      const extractResult = await extractResponse.json();
      console.log('Extraction result:', extractResult);
      
      if (!extractResult.found) {
        // Log debug information if available
        if (extractResult.debug) {
          console.log('PDF Debug Info:', extractResult.debug);
          console.log('Text length:', extractResult.debug.textLength);
          console.log('Has VT text:', extractResult.debug.hasVTText);
          console.log('First chars:', extractResult.debug.firstChars);
          console.log('Last chars:', extractResult.debug.lastChars);
          console.log('Search terms found:', extractResult.debug.searchTerms);
        }
        
        setVerificationResult({
          status: "invalid",
          message: extractResult.error || "No verification ID found in the document. This appears to be an invalid or unverified transcript."
        });
        toast({
          title: "Invalid Transcript",
          description: "No verification ID found in the uploaded document.",
          variant: "destructive"
        });
        return;
      }

      // Step 2: Verify the extracted ID
      const extractedId = extractResult.verificationId;
      console.log('Extracted verification ID:', extractedId);
      
      // Validate the extracted ID format
      console.log('Validating verification ID format...');
      const validation = validateVerificationId(extractedId);
      console.log('Validation result:', validation);
      
      if (!validation.isValid) {
        console.error('Validation failed:', validation.error);
        setVerificationResult({
          status: "invalid",
          message: "Invalid verification ID format found in document."
        });
        toast({
          title: "Invalid Document",
          description: "Document contains invalid verification ID format.",
          variant: "destructive"
        });
        return;
      }
      
      console.log('Validation passed, proceeding to blockchain verification...');

      // Step 3: Verify using blockchain or database
      console.log('Attempting blockchain verification...');
      const blockchainResult = await verifyDocument({
        action: 'verify_id',
        verificationId: extractedId
      });
      
      console.log('Blockchain verification result:', blockchainResult);

      if (blockchainResult && blockchainResult.valid) {
        console.log('Blockchain verification successful!');
        setVerificationResult({
          status: "verified",
          verificationId: extractedId,
          studentName: blockchainResult.metadata?.studentName,
          institution: blockchainResult.metadata?.institution,
          issueDate: blockchainResult.metadata?.issueDate,
          blockchainTx: blockchainResult.metadata?.blockchainTx,
          fileHash: blockchainResult.documentHash,
          message: isBlockchainEnabled ? "Document verified on blockchain" : "Document verified from uploaded file"
        });
        
        toast({
          title: "Verification Successful",
          description: `Document verified! Verification ID: ${extractedId}`,
        });
      } else {
        console.log('Blockchain verification failed or not available, falling back to database verification...');
        
        // Fallback to verification with limit checking (no auth required)
        let result = null;
        let error = null;
        
        try {
          console.log('Calling verify-with-limit function...');
          
          // Add timeout to the fetch request
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const response = await fetch('https://nohrizhxwrsinsyyojju.supabase.co/functions/v1/verify-with-limit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              verificationId: extractedId,
              ipAddress: 'unknown', // Skip IP fetch due to CSP restrictions
              userAgent: navigator.userAgent
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          console.log('verify-with-limit fetch completed');
          console.log('Response status:', response.status);
          console.log('Response ok:', response.ok);
          
          try {
            if (response.ok) {
              console.log('Parsing successful response...');
              result = await response.json();
              console.log('Parsed result:', result);
            } else {
              console.log('Handling error response...');
              const errorText = await response.text();
              console.log('Error text:', errorText);
              error = { message: errorText, status: response.status };
            }
          } catch (parseError) {
            console.error('Error parsing response:', parseError);
            error = { message: 'Failed to parse response', details: parseError.message };
          }
          
          if (error && error.context?.status === 429) {
            try {
              const errorResponse = await error.context.json();
              if (errorResponse.limitExceeded) {
                result = errorResponse;
                error = null;
              }
            } catch (parseError) {
              console.error('Error parsing limit exceeded response:', parseError);
            }
          }
        } catch (verifyError) {
          console.error('Verification function error:', verifyError);
          console.error('Error details:', verifyError.message);
          if (verifyError.name === 'AbortError') {
            console.error('Request timed out after 10 seconds');
          }
          error = verifyError;
        }

        console.log('Processing verification result. Error:', !!error, 'Result:', !!result);
        console.log('Result details:', { hasResult: !!result, limitExceeded: result?.limitExceeded, verified: result?.verified });
        
        if (error) {
          console.error('Verification error:', error);
          setVerificationResult({
            status: "invalid",
            message: "Verification failed"
          });
          toast({
            title: "Verification Failed",
            description: "Unable to verify the document. Please try again.",
            variant: "destructive"
          });
        } else if (result?.limitExceeded) {
          console.log('Limit exceeded case');
          setVerificationResult({
            status: "limit_exceeded",
            message: "Verification limit exceeded",
            verificationCount: result.verificationCount,
            verificationLimit: result.verificationLimit,
            verificationId: extractedId
          });
          toast({
            title: "Verification Limit Exceeded",
            description: `You have reached your verification limit (${result.verificationCount}/${result.verificationLimit}).`,
            variant: "destructive"
          });
        } else if (result?.valid || result?.verified) {
          console.log('Success case - setting verification result');
          console.log('Full result data:', result);
          console.log('Student data:', result.student);
          console.log('Institution data:', result.institution);
          console.log('Transcript data:', result.transcript);
          console.log('Available student name fields:', {
            full_name: result.student?.full_name,
            name: result.student?.name,
            studentName: result.studentName
          });
          
          setVerificationResult({
            status: "verified",
            verificationId: extractedId,
            // Correct field mappings based on actual API response
            studentName: result.student?.name || "Unknown Student",
            institution: result.institution?.name || "Unknown Institution", 
            // Issue date is in transcript.issuedAt
            issueDate: result.transcript?.issuedAt 
              ? new Date(result.transcript.issuedAt).toLocaleDateString()
              : "Not Available",
            message: "Document verified from uploaded file",
            // Add verification usage information
            verificationCount: result.verificationCount || 0,
            verificationLimit: result.verificationLimit || 5,
            // Blockchain TX is in transcript.blockchainTx
            blockchainTx: result.transcript?.blockchainTx || null,
            fileHash: result.documentHash || result.fileHash || null,
            // Add any other relevant data
            transcriptId: result.transcript?.id,
            studentEmail: result.student?.email,
            institutionId: result.institution?.id
          });
          
          toast({
            title: "Verification Successful",
            description: `Document verified! Verification ID: ${extractedId} (${result.verificationCount || 1}/${result.verificationLimit || 5} attempts used)`,
          });
        } else {
          console.log('Fallback case - no valid result');
          setVerificationResult({
            status: "invalid",
            message: "Document verification failed - ID not found in database"
          });
          toast({
            title: "Verification Failed",
            description: "The verification ID in the document could not be verified.",
            variant: "destructive"
          });
        }
      }
    } catch (error: any) {
      console.error('File verification error:', error);
      setVerificationResult({
        status: "invalid",
        message: "File verification failed"
      });
      toast({
        title: "Error",
        description: "Failed to process the uploaded file.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-4 w-4 mr-2" />
            Verified & Authentic
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="h-4 w-4 mr-2" />
            Pending Verification
          </Badge>
        );
      case "invalid":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="h-4 w-4 mr-2" />
            Invalid Document
          </Badge>
        );
      case "rate_limited":
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200">
            <AlertCircle className="h-4 w-4 mr-2" />
            Rate Limited
          </Badge>
        );
      case "limit_exceeded":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="h-4 w-4 mr-2" />
            Limit Exceeded
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ResponsiveNavbar 
        title="Transcript Verification"
        userType="public"
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-gradient-hero rounded-full p-3 sm:p-4">
              <img 
                src="https://umatsridinternship.com/images/logo.png" 
                alt="LOGO" 
                className="h-8 w-8 sm:h-12 sm:w-12 object-contain"
              />
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 px-4">Verify Academic Transcript</h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto px-4">
            Instantly verify the authenticity of any academic transcript using blockchain technology. 
            No registration required - simply enter the verification ID or upload the document.
          </p>
        </div>

        <Card className="shadow-medium">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Search className="h-5 w-5" />
              Verification Methods
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <Tabs defaultValue="id" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="id" className="text-sm sm:text-base">Verification ID</TabsTrigger>
                <TabsTrigger value="file" className="text-sm sm:text-base">Upload File</TabsTrigger>
              </TabsList>
              
              <TabsContent value="id" className="space-y-4">
                <form onSubmit={verifyById} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="verificationId" className="text-sm sm:text-base">Enter Verification ID</Label>
                    <Input
                      id="verificationId"
                      type="text"
                      placeholder="VT-1753152838463-59sk1mi9y"
                      value={verificationId}
                      onChange={(e) => setVerificationId(e.target.value)}
                      className="font-mono text-sm sm:text-base h-11 sm:h-10"
                      required
                    />
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Find the verification ID on your downloaded transcript
                    </p>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-primary hover:opacity-90 h-11 sm:h-10 text-sm sm:text-base"
                    disabled={isLoading}
                  >
                    {isLoading ? "Verifying..." : "Verify Transcript"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="file" className="space-y-4">
                <form onSubmit={verifyByFile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="transcriptFile" className="text-sm sm:text-base">Upload Transcript File</Label>
                    <Input
                      id="transcriptFile"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      className="h-11 sm:h-10 text-sm sm:text-base"
                      required
                    />
                    {uploadedFile && (
                      <p className="text-xs sm:text-sm text-muted-foreground break-all">
                        Selected: {uploadedFile.name}
                      </p>
                    )}
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-secondary hover:opacity-90 h-11 sm:h-10 text-sm sm:text-base"
                    disabled={isLoading || !uploadedFile}
                  >
                    {isLoading ? "Verifying..." : "Verify by File"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Verification Results */}
        {verificationResult && (
          <Card className="mt-6 sm:mt-8 shadow-strong">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Shield className="h-5 w-5" />
                  Verification Results
                </CardTitle>
                {getStatusBadge(verificationResult.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
              {verificationResult.status === 'invalid' || verificationResult.status === 'rate_limited' || verificationResult.status === 'limit_exceeded' ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground mb-4">
                    {verificationResult.message || "Verification failed"}
                  </div>
                  {verificationResult.status === 'limit_exceeded' ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                      <p className="text-sm text-yellow-800">
                        <strong>Verification Limit Reached:</strong> {verificationResult.verificationCount}/{verificationResult.verificationLimit} attempts used
                      </p>
                      <p className="text-xs text-yellow-700 mt-2">
                        Contact your institution to reset the verification limit.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Please check the verification ID and try again
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs sm:text-sm text-muted-foreground">Student</span>
                      </div>
                      <p className="font-semibold text-sm sm:text-base">{verificationResult.studentName || "Unknown Student"}</p>
                      {verificationResult.studentEmail && (
                        <p className="text-xs text-muted-foreground mt-1 break-all">{verificationResult.studentEmail}</p>
                      )}
                    </div>
                    
                    <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs sm:text-sm text-muted-foreground">Institution</span>
                      </div>
                      <p className="font-semibold text-sm sm:text-base">{verificationResult.institution || "Unknown Institution"}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 sm:space-y-4">
                    <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs sm:text-sm text-muted-foreground">Document Type</span>
                      </div>
                      <p className="font-semibold text-sm sm:text-base">Academic Transcript</p>
                    </div>
                    
                    <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs sm:text-sm text-muted-foreground">Issue Date</span>
                      </div>
                      <p className="font-semibold text-sm sm:text-base">{verificationResult.issueDate || "Not Available"}</p>
                    </div>
                  </div>
                </div>
              )}

              {verificationResult.status !== 'invalid' && verificationResult.status !== 'rate_limited' && verificationResult.status !== 'limit_exceeded' && (
                <>
                  {/* Verification Count Information */}
                  {(verificationResult.verificationCount !== undefined && verificationResult.verificationLimit !== undefined) && (
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-3">Verification Usage</h4>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-900">Verification Attempts Used:</span>
                          <Badge variant="outline" className="text-blue-700 border-blue-300">
                            {verificationResult.verificationCount}/{verificationResult.verificationLimit}
                          </Badge>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${(verificationResult.verificationCount / verificationResult.verificationLimit) * 100}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-blue-700 mt-2">
                        {Math.max(0, (verificationResult.verificationLimit || 5) - (verificationResult.verificationCount || 0))} verifications remaining
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Blockchain Verification Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-muted/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Verification ID</span>
                      </div>
                      <p className="font-mono text-sm break-all">{verificationResult.verificationId}</p>
                    </div>
                    
                    <div className="bg-muted/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Blockchain TX</span>
                        <Badge variant="outline" className="text-xs ml-auto">
                          {verificationResult.blockchainTx?.startsWith('0x') ? 'Secured' : 'Pending'}
                        </Badge>
                      </div>
                      <p className="font-mono text-sm break-all">{verificationResult.blockchainTx || "Processing..."}</p>
                      {verificationResult.blockchainTx?.startsWith('0x') && (
                        <p className="text-xs text-muted-foreground mt-2">
                          ✓ This transcript is secured on the blockchain
                        </p>
                      )}
                    </div>
                  </div>
                  </div>
                </>
              )}

              {verificationResult.status !== 'invalid' && verificationResult.status !== 'rate_limited' && verificationResult.status !== 'limit_exceeded' && (
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => {
                      toast({
                        title: "Feature Coming Soon",
                        description: "Download report functionality will be available soon"
                      });
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Report
                  </Button>
                  {verificationResult.blockchainTx && (
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        if (verificationResult.blockchainTx?.startsWith('0x')) {
                          // Open in Etherscan (Ethereum mainnet) - can be updated for other networks
                          const explorerUrl = `https://etherscan.io/tx/${verificationResult.blockchainTx}`;
                          window.open(explorerUrl, '_blank');
                          toast({
                            title: "Opening Blockchain Explorer",
                            description: "Viewing transaction on Etherscan"
                          });
                        } else {
                          toast({
                            title: "Transaction Not Available",
                            description: "Blockchain transaction is still pending or not yet recorded"
                          });
                        }
                      }}
                      disabled={!verificationResult.blockchainTx?.startsWith('0x')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View on Blockchain
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Information Section */}
        <Card className="mt-8 bg-muted/50">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <Shield className="h-12 w-12 text-primary mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Blockchain Secured</h3>
                <p className="text-sm text-muted-foreground">
                  Every transcript is cryptographically secured on the blockchain
                </p>
              </div>
              
              <div className="text-center">
                <CheckCircle className="h-12 w-12 text-verified mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Instant Verification</h3>
                <p className="text-sm text-muted-foreground">
                  Verify authenticity in seconds without contacting institutions
                </p>
              </div>
              
              <div className="text-center">
                <FileText className="h-12 w-12 text-secondary mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Tamper Proof</h3>
                <p className="text-sm text-muted-foreground">
                  Any alteration to the document is immediately detectable
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default VerifyTranscript;