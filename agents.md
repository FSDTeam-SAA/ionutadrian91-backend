Feature: Leave management (DONE)

Leave type: it is gebric only have to chekc the leave balace has or not weho is applying leave and date range of that le
Employee can apply for leave
Manager can approve/reject leave
Employee can view their leave balance and history   
now admin can see total request ahdmign all time ,and also monthly daily pending leave request,approved request and emaployee deatils who ahve applied for the leave and during apply for leave use have to add reason and additional fiels to uplaod foras supporting document 

admin can see there work details like shift details and everything reqwust on apprved ont and and can filter wilth departmetns , date range 
search by emplopyee name alkso and a specifc api for seeing in calediner that on a specifca ates whch emplyees are on lever front end will integrate it in a seerate cqler  and admin will clik on that caleger ans see all of the employee onthis date bu deault the api will get all empoyeed on laodve on date month and yeasr so that front end can show on calender 
and after maing teh end pints 
sync all the new endpiints withthe scaler wich is used for api docuemehjtson if needs any supporting api to call any of teh new aps tehn also add that api proeprly and add ftring proerly 


Feature: Task assignment (DONE)

this module name will be whereabouts so in this section first admin will aissig the task to contractor team cutomer 
so fields will be title 
then projects (PROJECTS WILL BE SELECTED FROM THE PROJECTS CREATED BEFORE FRONT END WILL SHOW DROPT DOWN OF ALL PROKJECTS SO HERE NEED THE GET ALL PROJECTS WHIWICH IS ALRADY BNULD END PINT PLEASE CHECK IT IS ECSTS OR NOT 
THEN DATE AND TIME 
LOCATION LONGITUDE LADITUDE ADDRESS NAME 
THEN ADD MEMBERS ADMI WILL SELECT MEMBERS BY SEARCHIG THERE NAMES AND FILTERING BY ENGINEERS AND WORKERS  SO IN FRONT END TERH WILL BE TWO BUTTON ENFINERS WORKERS WHEN ADIN WILL CLIK O THE ENGINEERS IT WILL GET ALL ENGINEERS AND IF CLIK ON WORKERS THEN IT WILL GET ALL WORKERS NOW DURING ONBORADING I THINK THERE IS NOT FIELD FOR DEFINE ENGINEER OR WOEKER SO ADD IT THRE DURING ADDING A TEAM MEMBER 

SO UNDER A TASK ASSING YOU HAVE ADD SELEDTEC ENGGERS AND WORKERS ID IN ARRAY  AND A NOTES FIELDS THEN CEATE ASSING MENT API ENGORN THEN GET ALL GET BUY ID EDIT FILTERINGT BY RTASK NAME AND SO ON 

AND MOST IMPORTANT LY DATE FILTERING )

AND ANALYTING TOTAL ASSIGENTS ON SPECFIC DATES MONTH YESTS BECAYSE IN THE CALENDER IT WILL BE SHONW LIKE GOOGLE CALENDER SO 

Feature: Duty of care (DONE)
- Employees can clock in (start time) and clock out (end time)
- Optionally select the assigned project
- Admins can get all records with filtering by date, team member, and project

Feature: Incident Report (DONE)
- Everyone can submit an incident report selecting project, date, details, and location
- Option to upload photo evidence
- Default status is NEW, Admins can update to INVESTIGATING or CLOSED
- Admin can add investigation details and root cause
- Admin dashboard to see total incidents by status with date filtering
