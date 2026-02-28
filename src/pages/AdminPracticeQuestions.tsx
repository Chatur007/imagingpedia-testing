import AdminQuestions from "./AdminQuestions";
import { Helmet } from "react-helmet-async";
import RequireAdminAuth from "@/components/RequireAdminAuth";

const AdminPracticeQuestionsPage = () => {
  return (
    <RequireAdminAuth>
      <Helmet>
        <title>Admin - Manage Practice Questions - Imagingpedia</title>
      </Helmet>
      <AdminQuestions initialPracticeMode={true} />
    </RequireAdminAuth>
  );
};

export default AdminPracticeQuestionsPage;
