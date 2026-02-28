import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Clock, FileQuestion, CheckCircle
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const PracticeTest = () => {
  const location = useLocation() as { state?: any };
  const navigate = useNavigate();
  const incoming = location.state?.testInfo as
    | { id: number; name: string; email: string; subjectId: number; startedAt: number }
    | undefined;

  const [selectedCourse, setSelectedCourse] = useState<string>(incoming?.subjectId?.toString() ?? "");
  const [testAnswers, setTestAnswers] = useState<{[key: string]: {[key: number]: string}}>({});
  const [subjects, setSubjects] = useState<any[]>([]);
  const [showTestResults, setShowTestResults] = useState<{[key: string]: boolean}>({});
  const [questions, setQuestions] = useState<any[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [subjectName, setSubjectName] = useState("");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [testStarted, setTestStarted] = useState(false);
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const subjectLocked = Boolean(incoming?.subjectId);

  const resolveImageUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:") || url.startsWith("blob:")) return url;
    if (url.startsWith("/uploads/")) return `${API_BASE_URL}${url}`;
    if (!url.includes("/")) return `${API_BASE_URL}/uploads/${url}`;
    return url;
  };

  // Fetch questions from database. If we have an incoming subjectId (launched from StartTest)
  // use the practice questions for that subject. Otherwise use the selected tab/course.
  useEffect(() => {
    // Fetch available subjects (prefer practice_subjects)
    const fetchSubjects = async () => {
      try {
        let res = await fetch(`${API_BASE_URL}/practice-subjects`);
        if (!res.ok) res = await fetch(`${API_BASE_URL}/subjects`);
        if (res.ok) {
          const data = await res.json();
          setSubjects(data || []);
          // If no selectedCourse yet, set to first subject id
          if (!selectedCourse && data && data.length > 0) {
            setSelectedCourse(data[0].id?.toString() ?? "");
            setSubjectName(data[0].subject_name || "");
          }
        }
      } catch (err) {
        console.error("Error fetching subjects:", err);
      }
    };

    fetchSubjects();

    const fetchQuestions = async () => {
      const subjectId = (incoming?.subjectId ?? parseInt(selectedCourse as any, 10)) || 1;
      setIsLoadingQuestions(true);
      try {
        // Fetch subject name when available (prefer practice_subjects)
        try {
          let subjectRes = await fetch(`${API_BASE_URL}/practice-subjects/${subjectId}`);
          if (!subjectRes.ok) subjectRes = await fetch(`${API_BASE_URL}/subjects/${subjectId}`);
          if (subjectRes.ok) {
            const subjectData = await subjectRes.json();
            setSubjectName(subjectData.subject_name);
          }
        } catch (err) {
          // ignore subject name errors
        }

        // Prefer practice-questions endpoint (new table). Fall back to regular questions if missing.
        let questionsRes = await fetch(`${API_BASE_URL}/practice-questions/subject/${subjectId}`);
        if (!questionsRes.ok) {
          questionsRes = await fetch(`${API_BASE_URL}/questions/subject/${subjectId}`);
        }

        if (questionsRes.ok) {
          const questionsData = await questionsRes.json();
          setQuestions(questionsData);
        } else {
          console.error('Failed to fetch questions for subject', subjectId);
          setQuestions([]);
        }
      } catch (error) {
        console.error("Error fetching questions:", error);
        setQuestions([]);
      } finally {
        setIsLoadingQuestions(false);
      }
    };

    fetchQuestions();
  }, [incoming?.subjectId, selectedCourse]);

  // Do not require coming from StartTest. PracticeTest can be opened directly.

  const handleAnswerChange = (courseId: string, questionId: number, answer: string) => {
    setTestAnswers(prev => ({
      ...prev,
      [courseId]: {
        ...(prev[courseId] || {}),
        [questionId]: answer
      }
    }));
  };

  const startTest = () => {
    setTestStarted(true);
    setCurrentQuestionIndex(0);
  };

  const submitCurrentQuestion = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    const currentAnswers = getCurrentAnswers();
    const userAnswer = currentAnswers[currentQuestion.id];

    if (!userAnswer || !userAnswer.trim()) {
      alert("Please provide an answer before proceeding.");
      return;
    }

    setSubmittingQuestion(true);
    try {
      // In practice mode we do not call any AI evaluation. We simply record the answer locally
      // and proceed to next question or show results so the user can compare with model answer.
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        setShowTestResults(prev => ({ ...prev, [selectedCourse]: true }));
      }
    } catch (error) {
      console.error("Error processing answer:", error);
      alert("Failed to process answer. Please try again.");
    } finally {
      setSubmittingQuestion(false);
    }
  };

  const submitTest = () => {
    // Just show results without any external evaluation
    setShowTestResults(prev => ({ ...prev, [selectedCourse]: true }));
  };

  const resetTest = (courseId: string) => {
    setTestAnswers(prev => {
      const updated = { ...prev };
      delete updated[courseId];
      return updated;
    });
    setShowTestResults(prev => ({ ...prev, [courseId]: false }));
    setCurrentQuestionIndex(0);
    setTestStarted(false);
  };

  const getCurrentAnswers = () => testAnswers[selectedCourse] || {};
  const isTestSubmitted = () => showTestResults[selectedCourse] || false;

  return (
    <>
      <Helmet>
        <title>Practice Test - Imagingpedia</title>
        <meta name="description" content="Practice tests - compare your answers to model answers" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="pt-24 pb-16">
          <section className="py-16">
            <div className="container mx-auto px-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center mb-12"
              >
                <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
                  Practice Test
                </h1>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                  Enter your answers and compare them with the pre-entered model answers from the database.
                </p>
              </motion.div>

              <div className="max-w-6xl mx-auto">
                <Tabs value={selectedCourse} onValueChange={subjectLocked ? () => {} : setSelectedCourse} className="w-full">
                  {!subjectLocked && (
                    <div className="w-full mb-8 flex items-center justify-center">
                      <label htmlFor="subject-select" className="sr-only">Select Subject</label>
                      <select
                        id="subject-select"
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                        className="max-w-md w-full border border-border rounded-md px-3 py-2 bg-background text-foreground"
                      >
                        {subjects && subjects.length > 0 ? (
                          subjects.map((s: any) => (
                            <option key={s.id} value={s.id?.toString()} className="capitalize">
                              {s.subject_name}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="1">Subject 1</option>
                            <option value="2">Subject 2</option>
                            <option value="3">Subject 3</option>
                            <option value="4">Subject 4</option>
                          </>
                        )}
                      </select>
                    </div>
                  )}

                  {subjectLocked && (
                    <div className="flex items-center justify-between glass-card p-4 mb-6">
                      <div>
                        <p className="text-sm text-muted-foreground">Candidate</p>
                        <p className="font-medium text-foreground">{incoming?.name} ({incoming?.email})</p>
                        <p className="text-sm text-muted-foreground mt-1">Subject: <span className="font-medium capitalize">{subjectName}</span></p>
                      </div>
                    </div>
                  )}

                  {isLoadingQuestions ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">Loading questions...</p>
                    </div>
                  ) : (
                    <TabsContent key={selectedCourse} value={selectedCourse} className="mt-0">
                      <div className="mb-8">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileQuestion className="text-primary" size={24} />
                          </div>
                          <div>
                            <h2 className="font-display text-3xl font-bold text-foreground">
                              {subjectName} Practice
                            </h2>
                            <p className="text-muted-foreground mt-1">
                              Enter your answers and then view model answers for comparison.
                            </p>
                          </div>
                        </div>
                      </div>

                      {!testStarted && !isTestSubmitted() && (
                        <div className="flex flex-col items-center justify-center py-12">
                          <div className="glass-card p-8 text-center max-w-2xl">
                            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                              <Clock className="text-primary" size={40} />
                            </div>
                            <h3 className="font-display text-2xl font-bold text-foreground mb-3">
                              Ready to Practice?
                            </h3>
                            <p className="text-muted-foreground mb-6">
                              This is an untimed practice session. You can review model answers after submitting.
                            </p>
                            <Button onClick={startTest} size="lg" className="min-w-[200px]">
                              Start Practice
                            </Button>
                          </div>
                        </div>
                      )}

                      {testStarted && !isTestSubmitted() && questions.length > 0 ? (
                        <div className="space-y-6">
                          <div className="glass-card p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-foreground">
                                Question {currentQuestionIndex + 1} of {questions.length}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}% Complete
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div 
                                className="bg-primary h-2 rounded-full transition-all duration-300"
                                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                              />
                            </div>
                          </div>

                          <motion.div
                            key={currentQuestionIndex}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3 }}
                            className="glass-card p-6"
                          >
                            <div className="flex gap-4 mb-4">
                              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                                {currentQuestionIndex + 1}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-foreground text-lg">
                                  Examine this medical image and provide your analysis.
                                </h4>
                              </div>
                            </div>

                            <div className="mb-6 rounded-lg overflow-hidden border border-border/50">
                              <img 
                                src={resolveImageUrl(questions[currentQuestionIndex].question_image)} 
                                alt={`Case ${currentQuestionIndex + 1}`}
                                className="w-full h-auto object-contain bg-black"
                              />
                            </div>

                            <div>
                              <Label htmlFor={`answer-current`} className="text-sm font-medium text-foreground mb-2 block">
                                Your Answer:
                              </Label>
                              <Textarea
                                id="answer-current"
                                placeholder="Describe your findings, observations, and diagnosis in detail..."
                                value={getCurrentAnswers()[questions[currentQuestionIndex].id] || ''}
                                onChange={(e) => handleAnswerChange(selectedCourse, questions[currentQuestionIndex].id, e.target.value)}
                                className="min-h-[150px] resize-y"
                                disabled={submittingQuestion}
                              />
                              <p className="text-xs text-muted-foreground mt-2">
                                {getCurrentAnswers()[questions[currentQuestionIndex].id]?.length || 0} characters
                              </p>
                            </div>
                          </motion.div>

                          <div className="flex justify-between items-center pt-6">
                            <Button
                              onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                              variant="outline"
                              disabled={currentQuestionIndex === 0 || submittingQuestion}
                            >
                              Previous Question
                            </Button>

                            <Button
                              onClick={submitCurrentQuestion}
                              size="lg"
                              disabled={submittingQuestion || !getCurrentAnswers()[questions[currentQuestionIndex].id]?.trim()}
                              className="min-w-[200px]"
                            >
                              {submittingQuestion ? (
                                "Processing..."
                              ) : currentQuestionIndex < questions.length - 1 ? (
                                "Save & Next"
                              ) : (
                                "Finish Practice"
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      {isTestSubmitted() && (
                        <div className="space-y-6">
                          <div className="glass-card p-8 text-center border-2 border-primary/50">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 bg-primary/10">
                              <CheckCircle className="text-primary" size={40} />
                            </div>
                            <h3 className="font-display text-3xl font-bold text-foreground mb-2">
                              Practice Complete
                            </h3>
                            <p className="text-lg text-muted-foreground mb-6">
                              Review your answers and compare them with the model answers below.
                            </p>
                            <div className="flex gap-4 justify-center">
                              <Button onClick={() => resetTest(selectedCourse)} variant="outline" size="lg">
                                Retake Practice
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-6">
                            <h3 className="font-display text-2xl font-bold text-foreground">
                              Review Your Answers
                            </h3>
                            {questions.map((question, index) => {
                              const userAnswer = getCurrentAnswers()[question.id];
                              return (
                                <div
                                  key={question.id}
                                  className="glass-card p-6 border-l-4 border-primary"
                                >
                                  <div className="flex gap-4 mb-4">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                                      {index + 1}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-start justify-between">
                                        <h4 className="font-semibold text-foreground text-lg mb-3">
                                          Medical Image Analysis
                                        </h4>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mb-6 rounded-lg overflow-hidden border border-border/50 max-w-2xl">
                                      <img 
                                        src={resolveImageUrl(question.question_image)} 
                                        alt={`Case ${index + 1}`}
                                        className="w-full h-auto object-contain bg-black"
                                      />
                                  </div>

                                  <div className="mb-6">
                                    <h5 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                      Your Answer:
                                    </h5>
                                    <div className="bg-blue-500/5 p-4 rounded-lg border border-blue-500/20">
                                      <p className="text-sm text-foreground whitespace-pre-wrap">{userAnswer}</p>
                                    </div>
                                  </div>

                                  <div className="mb-4">
                                    <h5 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                                      Model Answer:
                                    </h5>
                                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                                      <p className="text-sm text-foreground whitespace-pre-wrap">{question.model_answer}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default PracticeTest;
