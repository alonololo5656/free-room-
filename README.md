# כיתה פנויה – בליך

אתר/אפליקציה שמראה אילו חדרים פנויים בכל שעה, לפי מערכת השעות והשינויים של שחף (blich.shahaf.site).

## איך זה עובד
- `scrape.mjs` קורא את "מערכת ושינויים" של כל הכיתות (השבוע ושבוע הבא) ושומר `data.json`.
  חדר נחשב תפוס אם יש בו שיעור, מבחן או העברת חדר. ביטולים, טיולים ויום מקוון מפנים חדרים.
- `.github/workflows/update.yml` מריץ את זה אוטומטית כל 30 דקות בימים א'–ו' (בערך 06:00–17:00).
- `index.html` הוא האתר. אפשר להוסיף אותו למסך הבית כמו אפליקציה.

## העלאה לאינטרנט (חינם, חד-פעמי)
1. פותחים חשבון ב-github.com.
2. **New repository** → שם למשל `free-room` → **Public** → Create.
3. **uploading an existing file** → גוררים את **כל** הקבצים מהתיקייה, כולל התיקייה `.github` → Commit.
   (אם התיקייה `.github` לא עולה בגרירה: Add file → Create new file → בשם `.github/workflows/update.yml` → מדביקים את התוכן.)
4. **Settings → Actions → General → Workflow permissions** → מסמנים **Read and write** → Save.
5. **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main`, תיקייה `/ (root)` → Save.
6. **Actions → update timetable → Run workflow**, כדי לעדכן מיד.
7. אחרי דקה-שתיים האתר זמין בכתובת `https://<שם-המשתמש>.github.io/free-room/`.

## תפיסת כיתה (Firebase, חינם, פעם אחת)
בלי השלב הזה האתר עובד, רק בלי הכפתור "אני הולך/ת לשם".
1. נכנסים ל-console.firebase.google.com עם חשבון גוגל → **Create a project** (בלי Google Analytics).
2. בתפריט: **Build → Realtime Database → Create Database** → מיקום `europe-west1` → **Start in locked mode**.
3. בלשונית **Rules** מוחקים הכול, מדביקים את התוכן של `database.rules.json` → **Publish**.
4. בלשונית **Data** מעתיקים את הכתובת שלמעלה (משהו כמו `https://xxx-default-rtdb.europe-west1.firebasedatabase.app`).
5. ב-`index.html` שמים אותה בשורה `const DB_URL = '';` (בין הגרשיים, בלי `/` בסוף) ומעלים מחדש ל-GitHub.

תפיסה תקפה רק לשעה שנבחרה. חוקי המסד לא מאפשרים לתפוס חדר שמישהו כבר תפס.

## סטטיסטיקה – כמה נכנסים (Google Analytics, חינם, פעם אחת)
1. בקונסולה של Firebase נכנסים לפרויקט → ⚙️ **Project settings** → לשונית **Integrations** → **Google Analytics** → **Enable** (אפשר ליצור חשבון Analytics חדש).
2. באותו מקום ב-**Project settings → General**, למטה ב-**Your apps**, לוחצים על סמל ה-Web (`</>`) → נותנים שם → **Register app**.
   (אם כבר יש אפליקציית Web, היא מופיעה שם.)
3. מעתיקים את ה-`measurementId`, משהו כמו `G-ABC123XYZ`.
4. ב-`index.html` שמים אותו בשורה `const GA_ID = '';` (בין הגרשיים) ומעלים מחדש ל-GitHub.

איפה רואים את הנתונים: בקונסולה של Firebase → **Analytics → Dashboard**, או ב-analytics.google.com.
- **Realtime**: כמה אנשים באתר עכשיו (30 הדקות האחרונות).
- **Reports**: כמה משתמשים בכל יום, שבוע וחודש.
- האירוע `claim_room` סופר כמה פעמים תפסו כיתה.

הנתונים מתחילים להופיע ב-Realtime תוך דקות, ובדוחות הרגילים אחרי יום בערך. המערכת לא שומרת שמות, רק מספרים.

## התקנה בטלפון
- **אייפון (Safari):** כפתור שיתוף → "הוסף למסך הבית".
- **אנדרואיד (Chrome):** תפריט ⋮ → "הוסף למסך הבית" / "התקן אפליקציה".

## הרצה מקומית
```
node scrape.test.mjs
node scrape.mjs
npx http-server -p 8123
```
