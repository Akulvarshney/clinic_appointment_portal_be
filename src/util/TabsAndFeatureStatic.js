export const tabFeatureConfig = [
  {
    tab_number: 1,
    tab_unique_name: "DASHBOARD",
    tab_name: "Dashboard",
    tab_path: "/dashboard",
    features: [
      { feature_unique_name: "VIEW_DASHBOARD", feature_name: "View Dashboard" },
    ],
  },
  {
    tab_number: 2,
    tab_unique_name: "ADMIN_DASHBOARD",
    tab_name: "Admin Dashboard",
    tab_path: "/superadmin/dashboard",
    features: [
      {
        feature_unique_name: "VIEW_STATISTICS",
        feature_name: "View Statistics",
      },
    ],
  },
  {
    tab_number: 3,
    tab_unique_name: "APPOINTMENT",
    tab_name: "Appointment",
    tab_path: "/appointments",
    features: [
      {
        feature_unique_name: "VIEW_APPOINTMENTS",
        feature_name: "View Appointments",
      },
      {
        feature_unique_name: "ADD_APPOINTMENT",
        feature_name: "Add Appointment",
      },
      {
        feature_unique_name: "EDIT_APPOINTMENT",
        feature_name: "Edit Appointment",
      },
      {
        feature_unique_name: "DELETE_APPOINTMENT",
        feature_name: "Delete Appointment",
      },
    ],
  },
  {
    tab_number: 4,
    tab_unique_name: "CLIENT_LISTING",
    tab_name: "Client Listing",
    tab_path: "/clients",
    features: [
      { feature_unique_name: "VIEW_CLIENTS", feature_name: "View Clients" },
      { feature_unique_name: "ADD_CLIENT", feature_name: "Add Client" },
      { feature_unique_name: "EDIT_CLIENT", feature_name: "Edit Client" },
      { feature_unique_name: "DELETE_CLIENT", feature_name: "Delete Client" },
      { feature_unique_name: "VIEW_MOBILE", feature_name: "View Mobile" },
    ],
  },
  {
    tab_number: 5,
    tab_unique_name: "EMPLOYEE_MANAGEMENT",
    tab_name: "Employee Management",
    tab_path: "/employeeManagement",
    features: [
      { feature_unique_name: "VIEW_EMPLOYEES", feature_name: "View Employees" },
      { feature_unique_name: "ADD_EMPLOYEE", feature_name: "Add Employee" },
      { feature_unique_name: "EDIT_EMPLOYEE", feature_name: "Edit Employee" },
      {
        feature_unique_name: "DELETE_EMPLOYEE",
        feature_name: "Delete Employee",
      },
    ],
  },
  {
    tab_number: 6,
    tab_unique_name: "DOCTOR_MANAGEMENT",
    tab_name: "Doctor Management",
    tab_path: "/doctorManagement",
    features: [
      { feature_unique_name: "VIEW_DOCTORS", feature_name: "View Doctors" },
      { feature_unique_name: "ADD_DOCTOR", feature_name: "Add Doctor" },
      { feature_unique_name: "EDIT_DOCTOR", feature_name: "Edit Doctor" },
      { feature_unique_name: "DELETE_DOCTOR", feature_name: "Delete Doctor" },
    ],
  },

  {
    tab_number: 7,
    tab_unique_name: "SERVICE_MANAGEMENT",
    tab_name: "Service Management",
    tab_path: "/servicesManagement",
    features: [
      { feature_unique_name: "VIEW_SERVICES", feature_name: "View Services" },
      { feature_unique_name: "ADD_SERVICE", feature_name: "Add Service" },
      { feature_unique_name: "EDIT_SERVICE", feature_name: "Edit Service" },
      { feature_unique_name: "DELETE_SERVICE", feature_name: "Delete Service" },
    ],
  },
  {
    tab_number: 8,
    tab_unique_name: "RESOURCE_MANAGEMENT",
    tab_name: "Resource Management",
    tab_path: "/resourceManagement",
    features: [
      { feature_unique_name: "VIEW_RESOURCES", feature_name: "View Resources" },
      { feature_unique_name: "ADD_RESOURCE", feature_name: "Add Resource" },
      { feature_unique_name: "EDIT_RESOURCE", feature_name: "Edit Resource" },
      {
        feature_unique_name: "DELETE_RESOURCE",
        feature_name: "Delete Resource",
      },
    ],
  },
  {
    tab_number: 9,
    tab_unique_name: "SETTINGS",
    tab_name: "Settings",
    tab_path: "/settings",
    features: [
      { feature_unique_name: "PROFILE_PAGE", feature_name: "Profile Page" },
      { feature_unique_name: "MANAGE_USERS", feature_name: "Manage Users" },
      {
        feature_unique_name: "SYSTEM_PREFERENCES",
        feature_name: "System Preferences",
      },
      { feature_unique_name: "AUDIT_LOGS", feature_name: "Audit Logs" },
      {
        feature_unique_name: "ROLE_MANAGEMENT",
        feature_name: "Role Management",
      },
      {
        feature_unique_name: "CLIENT_CATEGORIES",
        feature_name: "Client Categories",
      },
    ],
  },
];
