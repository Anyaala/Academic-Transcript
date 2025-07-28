import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  GraduationCap, 
  Download, 
  Shield, 
  FileText, 
  Calendar,
  CheckCircle,
  Building,
  LogOut,
  QrCode,
  Copy,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const StudentDashboard = () => {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudentData = async () => {
      if (!user) return;

      try {
        console.log('StudentDashboard: Fetching student data for user:', user.id);
        let finalStudent = null;
        
        // Fetch student data
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select(`
            *,
            institutions!students_institution_id_fkey(name)
          `)
          .eq('user_id', user.id)
          .single();

        console.log('StudentDashboard: Student data fetch result:', {
          studentData,
          studentError,
          userEmail: user.email
        });

        if (studentError) {
          console.error('StudentDashboard: Error fetching student data:', studentError);
          
          // If no student found by user_id, try to find by email
          console.log('StudentDashboard: Trying to find student by email...');
          const { data: studentByEmail, error: emailError } = await supabase
            .from('students')
            .select(`
              *,
              institutions!students_institution_id_fkey(name)
            `)
            .eq('email', user.email)
            .single();

          console.log('StudentDashboard: Student by email result:', {
            studentByEmail,
            emailError
          });

          if (studentByEmail && !studentByEmail.user_id) {
            // Link the student record to this user
            console.log('StudentDashboard: Linking unlinked student record...');
            
            // Try using the RPC function first
            const { data: linkResult, error: linkError } = await supabase
              .rpc('link_student_to_user', {
                p_student_email: user.email,
                p_user_id: user.id
              });

            if (!linkError && linkResult) {
              console.log('StudentDashboard: Successfully linked student record using RPC');
              const linkedStudent = { ...studentByEmail, user_id: user.id };
              setStudent(linkedStudent);
              finalStudent = linkedStudent;
            } else {
              console.log('StudentDashboard: RPC linking failed, trying direct update:', linkError);
              
              // Fallback to direct update
              const { error: updateError } = await supabase
                .from('students')
                .update({ user_id: user.id, updated_at: new Date().toISOString() })
                .eq('id', studentByEmail.id);

              if (!updateError) {
                console.log('StudentDashboard: Successfully linked student record (direct update)');
                const linkedStudent = { ...studentByEmail, user_id: user.id };
                setStudent(linkedStudent);
                finalStudent = linkedStudent;
              } else {
                console.error('StudentDashboard: Error linking student record:', updateError);
                setStudent(studentByEmail); // Set it anyway, even if linking failed
                finalStudent = studentByEmail;
              }
            }
          } else if (studentByEmail) {
            setStudent(studentByEmail);
            finalStudent = studentByEmail;
          }
        } else {
          setStudent(studentData);
          finalStudent = studentData;
        }
        
        if (finalStudent) {
          console.log('StudentDashboard: Fetching transcripts for student:', finalStudent.id);
          
          // Fetch transcripts for this student with proper institution data
          const { data: transcriptsData, error: transcriptsError } = await supabase
            .from('transcripts')
            .select(`
              *,
              students!transcripts_student_id_fkey(
                full_name,
                institutions!students_institution_id_fkey(name)
              )
            `)
            .eq('student_id', finalStudent.id)
            .order('created_at', { ascending: false });

          console.log('StudentDashboard: Transcripts fetch result:', {
            transcriptsData,
            transcriptsError,
            studentId: finalStudent.id
          });

          setTranscripts(transcriptsData || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();

    // Set up real-time subscription for transcripts
    if (user) {
      const channel = supabase
        .channel('student-transcripts')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'transcripts'
          },
          (payload) => {
            console.log('Transcript change detected:', payload);
            fetchStudentData(); // Refetch data when transcripts change
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Verification ID copied successfully"
    });
  };

  const downloadTranscript = (fileUrl: string) => {
    window.open(fileUrl, '_blank');
    toast({
      title: "Download started",
      description: "Your transcript is being downloaded"
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <GraduationCap className="h-8 w-8 text-secondary mr-3" />
              <h1 className="text-2xl font-bold text-foreground">Student Portal</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="bg-secondary/10">
                <Shield className="h-3 w-3 mr-1" />
                {student?.full_name || "Student"}
              </Badge>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">My Academic Transcripts</h2>
          <p className="text-muted-foreground">View and download your verified academic transcripts</p>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading your transcripts...</p>
          </div>
        ) : transcripts.length === 0 ? (
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                  <h3 className="font-semibold text-foreground mb-2">No Transcripts Yet</h3>
                  <p className="text-muted-foreground">
                    Your institution hasn't uploaded any transcripts for you yet.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {transcripts.map((transcript) => (
            <Card key={transcript.id} className="bg-gradient-card border-0 shadow-medium">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl text-foreground mb-2">
                      Academic Transcript
                    </CardTitle>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building className="h-4 w-4" />
                      <span>{transcript.students?.institutions?.name || "Unknown Institution"}</span>
                    </div>
                  </div>
                  <Badge className={transcript.verified ? "bg-verified text-verified-foreground" : "bg-warning text-warning-foreground"}>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {transcript.verified ? "Verified" : "Pending"}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Issue Date</span>
                    </div>
                    <p className="font-semibold">{new Date(transcript.issued_at).toLocaleDateString()}</p>
                  </div>
                  
                  <div className="bg-white/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Upload Date</span>
                    </div>
                    <p className="font-semibold">{new Date(transcript.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="bg-white/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    Verification Information
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Verification ID:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-primary">{transcript.verification_id}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(transcript.verification_id)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {transcript.blockchain_tx && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Blockchain TX:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-secondary text-sm">{transcript.blockchain_tx}</span>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    onClick={async () => {
                      try {
                        // Fetch the file as blob
                        const response = await fetch(transcript.file_url);
                        if (!response.ok) throw new Error('Failed to fetch file');
                        
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        
                        // Create download link
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `transcript_${transcript.verification_id}.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        // Clean up the blob URL
                        window.URL.revokeObjectURL(url);
                        
                        toast({
                          title: "Download started",
                          description: "Your transcript is being downloaded"
                        });
                      } catch (error) {
                        console.error('Download error:', error);
                        toast({
                          title: "Download failed",
                          description: "Unable to download the transcript. Please try again.",
                          variant: "destructive"
                        });
                      }
                    }}
                    className="flex-1 bg-gradient-secondary hover:opacity-90"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Transcript
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/verify">
                      <Shield className="h-4 w-4 mr-2" />
                      Verify Online
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                  <h3 className="font-semibold text-foreground mb-2">Need Another Transcript?</h3>
                  <p className="text-muted-foreground mb-4">
                    Contact your institution to request additional transcripts
                  </p>
                  <Button variant="outline">
                    Contact Institution
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;