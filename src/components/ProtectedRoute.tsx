import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  userType: 'institution' | 'student';
}

const ProtectedRoute = ({ children, userType }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [redirectCount, setRedirectCount] = useState(0);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) {
        console.log('ProtectedRoute: No user, setting loading to false');
        setProfileLoading(false);
        return;
      }

      // Circuit breaker: check for redirect loops
      const redirectKey = `redirect_attempts_${user.id}_${userType}`;
      const currentAttempts = parseInt(localStorage.getItem(redirectKey) || '0');
      
      console.log(`ProtectedRoute: Fetching profile for user ${user.id}, expected type: ${userType}, attempts: ${currentAttempts}`);
      
      if (currentAttempts >= 3) {
        console.error('ProtectedRoute: Too many redirect attempts, showing error state');
        // Clear the redirect attempts to prevent permanent lockout
        localStorage.removeItem(redirectKey);
        setShowError(true);
        setProfileLoading(false);
        return;
      }

      try {
        // Check both tables to determine actual user type
        const [institutionResult, studentResult] = await Promise.all([
          supabase
            .from('institutions')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('students')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle()
        ]);

        console.log('ProtectedRoute: Profile lookup results:', {
          institutionData: institutionResult.data,
          studentData: studentResult.data,
          institutionError: institutionResult.error,
          studentError: studentResult.error,
          expectedUserType: userType
        });

        if (institutionResult.error || studentResult.error) {
          console.error('ProtectedRoute: Error fetching user profile:', institutionResult.error || studentResult.error);
        }

        // Set the appropriate profile based on what exists
        if (userType === 'institution' && institutionResult.data) {
          console.log('ProtectedRoute: Institution profile found, setting profile data');
          // Clear redirect attempts on success
          localStorage.removeItem(redirectKey);
          setUserProfile(institutionResult.data);
        } else if (userType === 'student' && studentResult.data) {
          console.log('ProtectedRoute: Student profile found, setting profile data');
          // Clear redirect attempts on success
          localStorage.removeItem(redirectKey);
          setUserProfile(studentResult.data);
        } else {
          // User is trying to access wrong dashboard - check which profile they actually have
          if (institutionResult.data && userType === 'student') {
            // User is an institution trying to access student dashboard
            console.log('ProtectedRoute: Institution user trying to access student dashboard, redirecting');
            setUserProfile('redirect_to_institution');
          } else if (studentResult.data && userType === 'institution') {
            // User is a student trying to access institution dashboard
            console.log('ProtectedRoute: Student user trying to access institution dashboard, redirecting');
            setUserProfile('redirect_to_student');
          } else {
            // No profile found at all - try to find and link unlinked student record
            console.log('ProtectedRoute: No profile found for user, checking for unlinked student record');
            
            if (userType === 'student') {
              // Check if there's a student record with this user's email but no user_id
              const { data: studentByEmail, error: emailError } = await supabase
                .from('students')
                .select('id, full_name, email, user_id')
                .eq('email', user.email)
                .maybeSingle();
              
              console.log('ProtectedRoute: Student by email check:', {
                studentByEmail,
                emailError,
                userEmail: user.email
              });
              
              if (studentByEmail && !studentByEmail.user_id) {
                console.log('ProtectedRoute: Found unlinked student record, linking it now...');
                
                // Link the student record to this user
                const { error: updateError } = await supabase
                  .from('students')
                  .update({ user_id: user.id })
                  .eq('id', studentByEmail.id);
                
                if (!updateError) {
                  console.log('ProtectedRoute: Successfully linked student record');
                  // Clear redirect attempts on success
                  localStorage.removeItem(redirectKey);
                  setUserProfile(studentByEmail);
                  return; // Exit early, don't set to null
                } else {
                  console.error('ProtectedRoute: Error linking student record:', updateError);
                }
              }
            }
            
            console.log('ProtectedRoute: No profile found for user, incrementing redirect count');
            // Increment redirect attempts
            localStorage.setItem(redirectKey, (currentAttempts + 1).toString());
            setUserProfile(null);
          }
        }
      } catch (error) {
        console.error('ProtectedRoute: Error fetching user profile:', error);
      } finally {
        console.log('ProtectedRoute: Setting profile loading to false');
        setProfileLoading(false);
      }
    };

    fetchUserProfile();
  }, [user, userType]);

  // Show error state if too many redirects
  if (showError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-4">Account Setup Issue</h2>
          <p className="text-muted-foreground mb-4">
            There seems to be an issue with your account setup. This usually happens when:
          </p>
          <ul className="text-sm text-muted-foreground text-left mb-6 space-y-2">
            <li>• Your institution hasn't created your student record yet</li>
            <li>• There's a mismatch between your email and the registered email</li>
            <li>• Your account needs to be linked by your institution</li>
          </ul>
          <div className="space-y-2">
            <button
              onClick={() => {
                // Clear redirect attempts and try again
                if (user) {
                  const redirectKey = `redirect_attempts_${user.id}_${userType}`;
                  localStorage.removeItem(redirectKey);
                }
                setShowError(false);
                setProfileLoading(true);
                window.location.reload();
              }}
              className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/90 mr-2"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = `/${userType}/login`}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while checking authentication
  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to={`/${userType}/login`} replace />;
  }

  // Handle redirects to correct dashboard
  if (userProfile === 'redirect_to_institution') {
    return <Navigate to="/institution/dashboard" replace />;
  }
  
  if (userProfile === 'redirect_to_student') {
    return <Navigate to="/student/dashboard" replace />;
  }

  // Redirect to login if no profile found
  if (!userProfile) {
    console.log('ProtectedRoute: No profile found, redirecting to login');
    return <Navigate to={`/${userType}/login`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;