import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ResponsiveNavbar } from "@/components/ResponsiveNavbar";
import { 
  Upload, 
  FileText, 
  ShieldCheck, 
  Building, 
  Users, 
  Search,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  LogOut,
  Edit,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const InstitutionDashboard = () => {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const [studentEmail, setStudentEmail] = useState("");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [institution, setInstitution] = useState<any>(null);
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newInstitutionName, setNewInstitutionName] = useState("");
  
  // Student creation state
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [newStudentPassword, setNewStudentPassword] = useState("");
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStudentName, setEditStudentName] = useState("");
  const [editStudentEmail, setEditStudentEmail] = useState("");
  const [updatingStudent, setUpdatingStudent] = useState(false);
  const [resettingVerificationCount, setResettingVerificationCount] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch institution data
        const { data: institutionData, error: institutionError } = await supabase
          .from('institutions')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        console.log('Institution data fetched:', institutionData);
        console.log('Institution error:', institutionError);
        console.log('User ID:', user.id);
        console.log('User metadata:', user.user_metadata);
        console.log('Institution name from DB:', institutionData?.name);
        console.log('Institution name from user metadata:', user.user_metadata?.name);
        
        // If institution name is empty but user metadata has a name, update it
        if (institutionData && (!institutionData.name || institutionData.name.trim() === '') && user.user_metadata?.name) {
          console.log('Attempting to fix empty institution name with metadata:', user.user_metadata.name);
          try {
            const { error: updateError } = await supabase
              .from('institutions')
              .update({ name: user.user_metadata.name })
              .eq('id', institutionData.id);
              
            if (!updateError) {
              institutionData.name = user.user_metadata.name;
              console.log('Successfully updated institution name from metadata');
            } else {
              console.error('Failed to update institution name:', updateError);
            }
          } catch (fixError) {
            console.error('Error fixing institution name:', fixError);
          }
        }
        
        setInstitution(institutionData);

        if (institutionData) {
          // Fetch transcripts for this institution's students
          const { data: transcriptsData } = await supabase
            .from('transcripts')
            .select(`
              *,
              student:students!inner(
                id,
                full_name,
                email,
                institution_id,
                verification_count,
                verification_limit
              )
            `)
            .eq('student.institution_id', institutionData.id)
            .order('created_at', { ascending: false });

          setTranscripts(transcriptsData || []);

          // Fetch students for this institution
          const { data: studentsData, error: studentsError } = await supabase
            .from('students')
            .select('id, full_name, email, institution_id, verification_count, verification_limit, created_at, updated_at, user_id')
            .eq('institution_id', institutionData.id)
            .order('created_at', { ascending: false });

          if (studentsError) {
            console.error('Error fetching students:', studentsError);
          } else {
            setStudents(studentsData || []);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up real-time subscription for transcripts
    if (user) {
      const channel = supabase
        .channel('institution-transcripts')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'transcripts'
          },
          (payload) => {
            console.log('Transcript change detected:', payload);
            fetchData(); // Refetch data when transcripts change
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingStudent(true);

    try {
      if (!newStudentName.trim() || !newStudentEmail.trim()) {
        throw new Error('Please fill in name and email fields');
      }

      if (!institution) {
        throw new Error('Institution not found');
      }

      console.log('Creating student record:', { name: newStudentName, email: newStudentEmail });

      // First, check if student already exists
      const { data: existingStudent } = await supabase
        .from('students')
        .select('*')
        .eq('email', newStudentEmail)
        .single();

      if (existingStudent) {
        throw new Error('A student with this email already exists');
      }

      // Create student record directly (without auth account)
      // The student will create their own auth account when they first sign up
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .insert([{
          full_name: newStudentName,
          email: newStudentEmail,
          institution_id: institution.id,
          user_id: null // Will be filled when student creates account
        }])
        .select()
        .single();

      if (studentError) {
        console.error('Student creation error:', studentError);
        throw studentError;
      }

      console.log('Student record created successfully:', studentData);

      toast({
        title: "Student Record Created",
        description: `${newStudentName} has been added. They can now sign up at the student login page using email ${newStudentEmail}.`,
      });

      // Reset form
      setNewStudentName("");
      setNewStudentEmail("");
      setNewStudentPassword("");

      // Refresh students list
      const { data: studentsData } = await supabase
        .from('students')
        .select('*')
        .eq('institution_id', institution.id)
        .order('created_at', { ascending: false });
      
      setStudents(studentsData || []);

    } catch (error: any) {
      console.error('Error creating student:', error);
      toast({
        title: "Error Creating Student",
        description: error.message || "Failed to create student record",
        variant: "destructive",
      });
    } finally {
      setCreatingStudent(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTranscriptFile(file);
    }
  };

  // Helper function to call PDF modification with proper auth
  const modifyPdfWithVerification = async (file: File, verificationId: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    
    if (!token) {
      throw new Error('No valid session token found. Please sign in again.');
    }

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('verificationId', verificationId);

    const response = await fetch(`https://nohrizhxwrsinsyyojju.supabase.co/functions/v1/add-verification-to-pdf`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PDF modification failed:', errorText);
      console.error('Response status:', response.status);
      throw new Error(`PDF modification failed: ${errorText} (Status: ${response.status})`);
    }

    return response.blob();
  };

  const handleSubmitTranscript = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('=== TRANSCRIPT UPLOAD STARTED ===');
    console.log('File:', transcriptFile?.name, 'Size:', transcriptFile?.size);
    console.log('Student email:', studentEmail);
    console.log('User:', user?.id);
    console.log('Institution:', institution?.id, institution?.name);
    
    if (!transcriptFile || !studentEmail || !user || !institution) {
      console.error('Missing required data:', {
        transcriptFile: !!transcriptFile,
        studentEmail: !!studentEmail,
        user: !!user,
        institution: !!institution
      });
      return;
    }

    setUploading(true);
    try {
      // First, find or create the student using upsert to handle duplicates
      console.log('=== STEP 1: Finding/Creating Student ===');
      let student;
      
      // Try to find existing student first
      console.log('Searching for existing student with email:', studentEmail);
      const { data: existingStudent, error: findError } = await supabase
        .from('students')
        .select('id, institution_id')
        .eq('email', studentEmail)
        .maybeSingle();

      console.log('Find student result:', { existingStudent, findError });

      // First try to find existing student by email
      if (existingStudent) {
        console.log('Found existing student:', existingStudent);
        
        // Check if student belongs to a different institution
        if (existingStudent.institution_id && existingStudent.institution_id !== institution.id) {
          throw new Error('Student belongs to a different institution');
        }
        
        // If student doesn't have institution_id, update it
        if (!existingStudent.institution_id) {
          console.log('Updating student institution...');
          const { error: updateError } = await supabase
            .from('students')
            .update({ 
              institution_id: institution.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingStudent.id);
            
          if (updateError) {
            console.error('Error updating student institution:', updateError);
            throw updateError;
          }
          
          student = { ...existingStudent, institution_id: institution.id };
        } else {
          student = existingStudent;
        }
      } else {
        // Create new student record
        console.log('Creating new student record...');
        const { data: newStudent, error: createError } = await supabase
          .from('students')
          .insert([{
            full_name: studentEmail.split('@')[0], // Use email prefix as temporary name
            email: studentEmail,
            institution_id: institution.id,
            user_id: null // Will be filled when student creates account
          }])
          .select()
          .single();
          
        if (createError) {
          console.error('Error creating student:', createError);
          throw createError;
        }
        
        student = newStudent;
      }
      console.log('Student found/created:', student);


      console.log('=== STEP 2: PDF Processing ===');
      // Generate verification ID first
      const verificationId = `VT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log('Generated verification ID:', verificationId);

      // Modify PDF to add verification ID using helper function
      console.log('Starting PDF modification...');
      const modifiedPdfBlob = await modifyPdfWithVerification(transcriptFile, verificationId);
      console.log('PDF modification successful, blob size:', modifiedPdfBlob.size);

      console.log('=== STEP 3: File Upload ===');
      // Convert blob response to file for upload
      const modifiedPdfFile = new File([modifiedPdfBlob], `verified_transcript_${verificationId}.pdf`, {
        type: 'application/pdf'
      });
      console.log('Created modified PDF file:', modifiedPdfFile.name, 'Size:', modifiedPdfFile.size);

      // Generate unique filename for the modified PDF
      const fileName = `transcript_${student.id}_${Date.now()}.pdf`;
      console.log('Storage filename:', fileName);

      // Upload modified file to Supabase storage
      console.log('Uploading to Supabase storage...');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('transcripts')
        .upload(`transcripts/${fileName}`, modifiedPdfFile);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }
      console.log('File uploaded successfully:', uploadData);

      console.log('=== STEP 4: Database Record ===');
      // Get file URL
      const { data: urlData } = supabase.storage
        .from('transcripts')
        .getPublicUrl(`transcripts/${fileName}`);
      
      const fileUrl = urlData.publicUrl;
      console.log('File URL:', fileUrl);

      // Create transcript record
      console.log('Creating transcript database record...');
      const { data: transcriptData, error: transcriptError } = await supabase
        .from('transcripts')
        .insert({
          student_id: student.id,
          file_url: fileUrl,
          file_hash: '', // Will be updated by blockchain function
          verification_id: verificationId,
          verified: true, // Auto-verify for institution uploads
        })
        .select()
        .single();

      if (transcriptError) {
        console.error('Transcript creation error:', transcriptError);
        throw transcriptError;
      }
      console.log('Transcript record created:', transcriptData);

      console.log('=== STEP 5: Blockchain Processing ===');
      // Call blockchain function to record on blockchain
      try {
        const fileContent = await new Promise((resolve, reject) => {
          const fileReader = new FileReader();
          fileReader.onload = (e) => resolve(e.target?.result);
          fileReader.onerror = reject;
          fileReader.readAsText(modifiedPdfFile);
        });
        
        console.log('Calling blockchain function with transcript ID:', transcriptData.id);
        const { data, error } = await supabase.functions.invoke('blockchain-transcript', {
          body: {
            transcriptId: transcriptData.id,
            studentEmail: studentEmail,
            fileContent: fileContent
          }
        });

        if (error) {
          console.error('Blockchain recording error:', error);
        } else {
          console.log('Blockchain record created successfully:', data);
        }
      } catch (blockchainError) {
        console.error('Blockchain recording failed:', blockchainError);
        // Continue with normal flow even if blockchain fails
      }


      // Reset form
      setStudentEmail("");
      setTranscriptFile(null);
      
      // Refresh transcripts list
      const { data: transcriptsData } = await supabase
        .from('transcripts')
        .select(`
          *,
          student:students!inner(
            id,
            full_name,
            email,
            institution_id,
            verification_count,
            verification_limit
          )
        `)
        .eq('student.institution_id', institution.id)
        .order('created_at', { ascending: false });

      setTranscripts(transcriptsData || []);
      
      toast({
        title: "Success",
        description: "Transcript uploaded and verified successfully!",
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      
      let errorMessage = error.message || "An unexpected error occurred during upload";
      let errorTitle = "Upload Failed";
      
      // Handle specific database errors
      if (error.code === '23505' && error.message?.includes('students_email_key')) {
        errorTitle = "Student Already Exists";
        errorMessage = `A student with email ${studentEmail} is already registered. Please check the email address.`;
      } else if (error.message?.includes('different institution')) {
        errorTitle = "Student Belongs to Different Institution";
        errorMessage = error.message;
      } else if (error.message?.includes('PDF modification failed')) {
        errorTitle = "PDF Processing Error";
        errorMessage = "Failed to add verification to PDF. Please try again or contact support.";
      } else if (error.message?.includes('session token')) {
        errorTitle = "Authentication Error";
        errorMessage = "Your session has expired. Please refresh the page and sign in again.";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };


  const updateInstitutionName = async () => {
    if (!newInstitutionName.trim() || !institution?.id) return;
    
    try {
      const { error } = await supabase
        .from('institutions')
        .update({ name: newInstitutionName.trim() })
        .eq('id', institution.id);
        
      if (error) throw error;
      
      // Update local state
      setInstitution({ ...institution, name: newInstitutionName.trim() });
      setEditingName(false);
      setNewInstitutionName("");
      
      toast({
        title: "Success",
        description: "Institution name updated successfully",
      });
    } catch (error: any) {
      console.error('Error updating institution name:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update institution name",
        variant: "destructive",
      });
    }
  };

  const handleUpdateStudent = async () => {
    if (!editingStudent || !editStudentName.trim() || !editStudentEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and email are required",
        variant: "destructive",
      });
      return;
    }

    setUpdatingStudent(true);
    try {
      // Update student information
      const { error } = await supabase
        .from('students')
        .update({
          full_name: editStudentName.trim(),
          email: editStudentEmail.trim()
        })
        .eq('id', editingStudent.id);

      if (error) {
        throw error;
      }

      // Update the local state
      setTranscripts(prev => prev.map(transcript => 
        transcript.student?.id === editingStudent.id
          ? {
              ...transcript,
              student: {
                ...transcript.student,
                full_name: editStudentName.trim(),
                email: editStudentEmail.trim()
              }
            }
          : transcript
      ));

      setStudents(prev => prev.map(student =>
        student.id === editingStudent.id
          ? {
              ...student,
              full_name: editStudentName.trim(),
              email: editStudentEmail.trim()
            }
          : student
      ));

      setShowEditModal(false);
      setEditingStudent(null);
      setEditStudentName("");
      setEditStudentEmail("");

      toast({
        title: "Success",
        description: "Student information updated successfully"
      });

    } catch (error: any) {
      console.error('Error updating student:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update student information",
        variant: "destructive",
      });
    } finally {
      setUpdatingStudent(false);
    }
  };

  const handleResetVerificationCount = async (studentId: string, studentName: string) => {
    console.log('Attempting to reset verification count for:', { studentId, studentName });
    
    if (!confirm(`Are you sure you want to reset the verification count for ${studentName}? This will allow them to verify transcripts again.`)) {
      return;
    }

    setResettingVerificationCount(studentId);
    try {
      const { data, error } = await supabase.functions.invoke('reset-verification-count', {
        body: { studentId }
      });

      console.log('Reset function response:', { data, error });

      if (error) {
        console.error('Reset function error details:', error);
        // Try to get more details from the error response
        if (error.context) {
          try {
            const errorText = await error.context.text();
            console.error('Error response body:', errorText);
          } catch (e) {
            console.error('Could not read error response:', e);
          }
        }
        throw error;
      }

      // Update local state to reflect the reset
      setStudents(prev => prev.map(student =>
        student.id === studentId
          ? { ...student, verification_count: 0 }
          : student
      ));

      setTranscripts(prev => prev.map(transcript => 
        transcript.student?.id === studentId
          ? {
              ...transcript,
              student: {
                ...transcript.student,
                verification_count: 0
              }
            }
          : transcript
      ));

      toast({
        title: "Success",
        description: `Verification count reset for ${studentName}`
      });

      // Force refresh the page data to ensure UI is updated
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error: any) {
      console.error('Error resetting verification count:', error);
      toast({
        title: "Reset Failed",
        description: error.message || "Failed to reset verification count",
        variant: "destructive",
      });
    } finally {
      setResettingVerificationCount(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-verified text-verified-foreground"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-warning"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ResponsiveNavbar 
        title="Institution Portal"
        userType="institution"
        userName={institution?.name || "Institution"}
        onLogout={signOut}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        {/* Institution Name Edit Section */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Manage Institution</h2>
              <div className="flex items-center gap-2 text-sm md:text-base text-muted-foreground">
                <Building className="h-4 w-4" />
                <span>
                  {editingName ? (
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                      <Input
                        value={newInstitutionName}
                        onChange={(e) => setNewInstitutionName(e.target.value)}
                        className="w-full md:w-64"
                        placeholder="Enter institution name"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            updateInstitutionName();
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={updateInstitutionName}
                          disabled={!newInstitutionName.trim()}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {
                            setEditingName(false);
                            setNewInstitutionName("");
                          }}
                        >
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>{institution?.name || "Click to set name"}</span>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => {
                          setEditingName(true);
                          setNewInstitutionName(institution?.name || "");
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="mb-6 md:mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Academic Transcript Management</h2>
          <p className="text-sm md:text-base text-muted-foreground">Upload and manage student transcripts with blockchain verification</p>
        </div>

        <Tabs defaultValue="students" className="space-y-4 md:space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="students" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4">
              <Users className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Students</span>
              <span className="sm:hidden">Users</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4">
              <Upload className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Upload Transcript</span>
              <span className="sm:hidden">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4">
              <FileText className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Manage Transcripts</span>
              <span className="sm:hidden">Manage</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="space-y-6">
            {/* Create Student Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Create New Student
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateStudent} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newStudentName">Full Name</Label>
                    <Input
                      id="newStudentName"
                      type="text"
                      placeholder="John Doe"
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newStudentEmail">Student Email</Label>
                    <Input
                      id="newStudentEmail"
                      type="email"
                      placeholder="student@university.edu"
                      value={newStudentEmail}
                      onChange={(e) => setNewStudentEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="bg-blue-50 p-3 rounded-lg border">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> The student will create their own password when they first sign up using this email address.
                      </p>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={creatingStudent}
                    className="w-full"
                  >
                    {creatingStudent ? "Creating Student..." : "Create Student"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Students List Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Students ({students.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {students.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No students found</p>
                    <p className="text-sm">Create your first student account above</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {students.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 p-2 rounded-full">
                            <Users className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{student.full_name}</p>
                            <p className="text-sm text-muted-foreground">{student.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {new Date(student.created_at).toLocaleDateString()}
                          </Badge>
                          <Badge variant={student.user_id ? "default" : "outline"}>
                            {student.user_id ? "Active" : "Pending"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="upload" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Student Transcript
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitTranscript} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="studentEmail">Student Email</Label>
                    <Input
                      id="studentEmail"
                      type="email"
                      placeholder="student@university.edu"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="transcript">Transcript File (PDF)</Label>
                    <Input
                      id="transcript"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      required
                    />
                    {transcriptFile && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {transcriptFile.name}
                      </p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-primary hover:opacity-90"
                    disabled={uploading}
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    {uploading ? "Processing & Uploading..." : "Process PDF & Upload Transcript"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Uploaded Transcripts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading transcripts...</p>
                  </div>
                ) : transcripts.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold text-foreground mb-2">No Transcripts Yet</h3>
                    <p className="text-muted-foreground">
                      Upload your first transcript using the form above.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {transcripts.map((transcript) => (
                      <div key={transcript.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-foreground">{transcript.student?.full_name || "Unknown Student"}</h3>
                            <p className="text-sm text-muted-foreground">{transcript.student?.email}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Uploaded: {new Date(transcript.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(transcript.verified ? "verified" : "pending")}
                          </div>
                        </div>
                      
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Verification ID:</span>
                            <p className="font-mono text-primary">{transcript.verification_id}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Verification Count:</span>
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-primary">
                                {transcript.student?.verification_count || 0}/{transcript.student?.verification_limit || 5}
                              </p>
                              {(transcript.student?.verification_count || 0) >= (transcript.student?.verification_limit || 5) && (
                                <Badge variant="destructive" className="text-xs">
                                  Limit Reached
                                </Badge>
                              )}
                            </div>
                          </div>
                          {transcript.blockchain_tx && (
                            <div>
                              <span className="text-muted-foreground">Blockchain TX:</span>
                              <p className="font-mono text-secondary truncate">{transcript.blockchain_tx}</p>
                            </div>
                          )}
                        </div>
                      
                        <div className="flex flex-wrap gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(transcript.file_url, '_blank')}
                            className="flex items-center gap-1"
                          >
                            <Download className="h-3 w-3" />
                            <span className="hidden md:inline">Download</span>
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedTranscript(transcript);
                              setShowDetailsModal(true);
                            }}
                            className="flex items-center gap-1"
                          >
                            <Search className="h-3 w-3" />
                            <span className="hidden md:inline">Details</span>
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-blue-600 hover:text-blue-700"
                            onClick={() => {
                              setEditingStudent(transcript.student);
                              setEditStudentName(transcript.student?.full_name || "");
                              setEditStudentEmail(transcript.student?.email || "");
                              setShowEditModal(true);
                            }}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          {(transcript.student?.verification_count || 0) >= (transcript.student?.verification_limit || 5) && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-green-600 hover:text-green-700"
                              onClick={() => handleResetVerificationCount(transcript.student.id, transcript.student?.full_name || "Unknown")}
                              disabled={resettingVerificationCount === transcript.student.id}
                            >
                              {resettingVerificationCount === transcript.student.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600 mr-1"></div>
                                  Resetting...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Reset Count
                                </>
                              )}
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-orange-600 hover:text-orange-700"
                            onClick={() => handleResetVerificationCount(transcript.student.id, transcript.student?.full_name || "Unknown")}
                            disabled={resettingVerificationCount === transcript.student.id}
                            title="Reset verification limit for this student"
                          >
                            {resettingVerificationCount === transcript.student.id ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-600 mr-1"></div>
                                Resetting...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Reset Limit
                              </>
                            )}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-red-600 hover:text-red-700"
                            onClick={async () => {
                              if (confirm("Are you sure you want to delete this transcript?")) {
                                try {
                                  console.log('Starting delete for transcript:', transcript.id);
                                  console.log('File URL:', transcript.file_url);
                                  
                                  // Extract the storage path from the URL
                                  // URL format: https://...supabase.co/storage/v1/object/public/transcripts/transcripts/filename.pdf
                                  const urlParts = transcript.file_url.split('/');
                                  const bucketIndex = urlParts.findIndex(part => part === 'transcripts');
                                  if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
                                    // Get everything after the bucket name
                                    const filePath = urlParts.slice(bucketIndex + 1).join('/');
                                    console.log('Extracted file path:', filePath);
                                    
                                    const { error: storageError } = await supabase.storage
                                      .from('transcripts')
                                      .remove([filePath]);
                                    
                                    if (storageError) {
                                      console.error('Storage deletion error:', storageError);
                                      // Continue with database deletion even if storage fails
                                    } else {
                                      console.log('File deleted from storage successfully');
                                    }
                                  }
                                  
                                  // Delete from database
                                  console.log('Deleting from database...');
                                  const { error: dbError } = await supabase
                                    .from('transcripts')
                                    .delete()
                                    .eq('id', transcript.id);
                                  
                                  if (dbError) {
                                    console.error('Database deletion error:', dbError);
                                    throw dbError;
                                  }
                                  
                                  console.log('Database deletion successful');
                                  
                                  // Immediately update the UI by removing the deleted transcript
                                  setTranscripts(prev => prev.filter(t => t.id !== transcript.id));
                                  
                                  toast({
                                    title: "Success",
                                    description: "Transcript deleted successfully"
                                  });
                                  
                                } catch (error: any) {
                                  console.error('Delete error:', error);
                                  toast({
                                    title: "Error",
                                    description: `Delete failed: ${error.message}`,
                                    variant: "destructive"
                                  });
                                }
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Transcript Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transcript Details</DialogTitle>
          </DialogHeader>
          
          {selectedTranscript && (
            <div className="space-y-6">
              {/* Student Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Student Information</h3>
                  <div className="space-y-1">
                    <p><span className="font-medium">Name:</span> {selectedTranscript.student?.full_name || "Unknown"}</p>
                    <p><span className="font-medium">Email:</span> {selectedTranscript.student?.email || "Unknown"}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Verification Status</h3>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Status:</span>
                      {getStatusBadge(selectedTranscript.verified ? "verified" : "pending")}
                    </div>
                    <p><span className="font-medium">Upload Date:</span> {new Date(selectedTranscript.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Verification Details */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Verification Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium">Verification ID:</span>
                    <p className="font-mono text-sm bg-muted p-2 rounded mt-1 break-all">
                      {selectedTranscript.verification_id}
                    </p>
                  </div>
                  {selectedTranscript.file_hash && (
                    <div>
                      <span className="font-medium">File Hash:</span>
                      <p className="font-mono text-sm bg-muted p-2 rounded mt-1 break-all">
                        {selectedTranscript.file_hash}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Blockchain Information */}
              {selectedTranscript.blockchain_tx && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Blockchain Information</h3>
                  <div>
                    <span className="font-medium">Transaction Hash:</span>
                    <p className="font-mono text-sm bg-muted p-2 rounded mt-1 break-all">
                      {selectedTranscript.blockchain_tx}
                    </p>
                  </div>
                </div>
              )}

              {/* File Information */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">File Information</h3>
                <div className="flex items-center gap-4">
                  <Button
                    onClick={() => window.open(selectedTranscript.file_url, '_blank')}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Transcript
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open(selectedTranscript.file_url, '_blank')}
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    View in Browser
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Student Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Student Information</DialogTitle>
          </DialogHeader>
          
          {editingStudent && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-student-name">Full Name</Label>
                <Input
                  id="edit-student-name"
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  placeholder="Enter student's full name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-student-email">Email</Label>
                <Input
                  id="edit-student-email"
                  type="email"
                  value={editStudentEmail}
                  onChange={(e) => setEditStudentEmail(e.target.value)}
                  placeholder="Enter student's email"
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingStudent(null);
                    setEditStudentName("");
                    setEditStudentEmail("");
                  }}
                  disabled={updatingStudent}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateStudent}
                  disabled={updatingStudent || !editStudentName.trim() || !editStudentEmail.trim()}
                  className="flex items-center gap-2"
                >
                  {updatingStudent ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Updating...
                    </>
                  ) : (
                    'Update Student'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstitutionDashboard;