import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  Building, 
  GraduationCap, 
  Search, 
  CheckCircle, 
  Zap, 
  Globe,
  ArrowRight
} from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-hero text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
              <img 
                src="https://umatsridinternship.com/images/logo.png" 
                alt="LOGO" 
                className="h-16 w-16 object-contain"
              />
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-6">
            Academic Transcript Verification
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto mb-8">
            Secure, instant, and tamper-proof transcript verification powered by blockchain technology. 
            Verify academic credentials with confidence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/verify">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                <Search className="h-5 w-5 mr-2" />
                Verify Transcript
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Portal Cards */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">Access Your Portal</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Choose your portal to access our comprehensive transcript verification system
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Institution Portal */}
            <Card className="bg-gradient-card border-0 shadow-medium hover:shadow-strong transition-shadow">
              <CardHeader className="text-center">
                <div className="bg-primary/10 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Building className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Institution Portal</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Upload and manage student transcripts with blockchain verification
                </p>
                <div className="space-y-2">
                  <Badge variant="outline">✓ Secure Upload</Badge>
                  <Badge variant="outline">✓ Blockchain Storage</Badge>
                  <Badge variant="outline">✓ Verification Management</Badge>
                </div>
                <Button asChild className="w-full bg-gradient-primary hover:opacity-90">
                  <Link to="/institution/login">
                    Access Portal
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Student Portal */}
            <Card className="bg-gradient-card border-0 shadow-medium hover:shadow-strong transition-shadow">
              <CardHeader className="text-center">
                <div className="bg-secondary/10 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <GraduationCap className="h-8 w-8 text-secondary" />
                </div>
                <CardTitle className="text-xl">Student Portal</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Access and download your verified academic transcripts
                </p>
                <div className="space-y-2">
                  <Badge variant="outline">✓ View Transcripts</Badge>
                  <Badge variant="outline">✓ Download Verified</Badge>
                  <Badge variant="outline">✓ Share Securely</Badge>
                </div>
                <Button asChild className="w-full bg-gradient-secondary hover:opacity-90">
                  <Link to="/student/login">
                    Access Portal
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Verification Portal */}
            <Card className="bg-gradient-card border-0 shadow-medium hover:shadow-strong transition-shadow">
              <CardHeader className="text-center">
                <div className="bg-accent/10 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Search className="h-8 w-8 text-accent" />
                </div>
                <CardTitle className="text-xl">Verify Transcript</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Instantly verify any academic transcript authenticity
                </p>
                <div className="space-y-2">
                  <Badge variant="outline">✓ Instant Verification</Badge>
                  <Badge variant="outline">✓ No Registration</Badge>
                  <Badge variant="outline">✓ Blockchain Proof</Badge>
                </div>
                <Button asChild className="w-full bg-accent text-accent-foreground hover:opacity-90">
                  <Link to="/verify">
                    Verify Now
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">Why Choose Our System?</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Blockchain Security</h3>
              <p className="text-muted-foreground">Every transcript is secured with immutable blockchain technology</p>
            </div>
            
            <div className="text-center">
              <Zap className="h-12 w-12 text-secondary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Instant Verification</h3>
              <p className="text-muted-foreground">Verify authenticity in seconds without contacting institutions</p>
            </div>
            
            <div className="text-center">
              <Globe className="h-12 w-12 text-accent mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Global Access</h3>
              <p className="text-muted-foreground">Access from anywhere with our secure web-based platform</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
