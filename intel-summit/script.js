// Intel Summit Check-In — Zefeng Wang
const GOAL = 50;
const form = document.getElementById('checkinForm');
const nameInput = document.getElementById('nameInput');
const teamSelect = document.getElementById('teamSelect');
const greetingEl = document.getElementById('greeting');
const totalEl = document.getElementById('totalCount');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const celebrationEl = document.getElementById('celebration');
const listEl = document.getElementById('attendeeList');
const leaderEl = document.getElementById('leaderText');
document.getElementById('goalText').textContent = GOAL;

let state = loadState();

function loadState(){
  try{
    const saved = JSON.parse(localStorage.getItem('summitCheckin'));
    if(saved && Array.isArray(saved.attendees)) return saved;
  }catch(e){}
  return { attendees: [] };
}
function saveState(){
  localStorage.setItem('summitCheckin', JSON.stringify(state));
}
function teamCounts(){
  const counts = {'Water Wise':0,'Net Zero':0,'Renewables':0};
  state.attendees.forEach(a=>{ if(counts[a.team]!==undefined) counts[a.team]++; });
  return counts;
}
function render(){
  const counts = teamCounts();
  const total = state.attendees.length;
  totalEl.textContent = total;
  document.getElementById('countWater').textContent = counts['Water Wise'];
  document.getElementById('countNet').textContent = counts['Net Zero'];
  document.getElementById('countRenew').textContent = counts['Renewables'];

  const pct = Math.min(100, Math.round((total/GOAL)*100));
  progressBar.style.width = pct + '%';
  progressText.textContent = pct + '% of goal (' + total + ' / ' + GOAL + ')';

  // leader
  let leader = null, max = -1;
  Object.entries(counts).forEach(([team,n])=>{ if(n>max){max=n; leader=team;} });
  if(total===0) leaderEl.textContent = 'No check-ins yet.';
  else leaderEl.textContent = 'Leading team: ' + leader + ' with ' + max + ' check-in' + (max===1?'':'s') + '.';

  // celebration LevelUp
  if(total >= GOAL){
    celebrationEl.hidden = false;
    celebrationEl.textContent = '🎉 Goal reached! ' + total + ' attendees checked in. Winning team: ' + leader + '!';
  } else {
    celebrationEl.hidden = true;
  }

  // attendee list LevelUp
  listEl.innerHTML = '';
  state.attendees.slice().reverse().forEach(a=>{
    const li = document.createElement('li');
    li.innerHTML = '<div><strong></strong><br><span></span></div><span></span>';
    li.querySelector('strong').textContent = a.name;
    li.querySelectorAll('span')[0].textContent = 'Team ' + a.team;
    li.querySelectorAll('span')[1].textContent = a.time;
    listEl.appendChild(li);
  });
  if(total===0){
    const li=document.createElement('li');
    li.textContent='No attendees yet — be the first to check in.';
    listEl.appendChild(li);
  }
}

form.addEventListener('submit', function(e){
  e.preventDefault();
  const name = nameInput.value.trim();
  const team = teamSelect.value;
  if(!name || !team){
    greetingEl.textContent = 'Please enter your name and choose a team.';
    return;
  }
  const attendee = { name, team, time: new Date().toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) };
  state.attendees.push(attendee);
  saveState();
  render();
  // personalized greeting
  greetingEl.textContent = 'Welcome, ' + name + '! Thanks for checking in with Team ' + team + '. Glad you are here for the Sustainability Summit.';
  form.reset();
  nameInput.focus();
});

document.getElementById('resetBtn').addEventListener('click', function(){
  state = { attendees: [] };
  saveState();
  greetingEl.textContent = 'Demo data cleared. Ready for new check-ins.';
  render();
});

render();
