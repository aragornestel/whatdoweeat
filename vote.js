document.addEventListener('DOMContentLoaded', function() {
    const nicknameSection = document.getElementById('nickname-section');
    const nicknameForm = document.getElementById('nickname-form');
    const nicknameInput = document.getElementById('nickname-input');
    
    const votePageSection = document.getElementById('vote-page-section');
    const voteTitle = document.getElementById('vote-title');
    const resultDescription = document.getElementById('result-description');
    const candidateListContainer = document.getElementById('candidate-list');
    const voteActions = document.querySelector('.vote-actions');
    const submitVoteBtn = document.getElementById('submit-vote-btn');
    
    let userNickname = '';
    const userSelections = new Set();
    let candidatesData = [];
    let voterTooltip;
    let storageKey = ''; // localStorage 키
    let voteState = {};  // 투표 상태를 저장할 객체

    // 페이지 로드 시 툴팁 엘리먼트를 한 번만 생성
    function createVoterTooltip() {
        voterTooltip = document.createElement('div');
        voterTooltip.className = 'voter-tooltip';
        voterTooltip.style.display = 'none';
        document.body.appendChild(voterTooltip);
    }

    function getCandidatesFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const data = urlParams.get('data');
        if (data) {
            try {
                const decodedData = decodeURIComponent(atob(data));
                return JSON.parse(decodedData);
            } catch (e) {
                console.error('URL 데이터 파싱 오류:', e);
                return [];
            }
        }
        return [];
    }

    function displayCandidates(candidates) {
        candidateListContainer.innerHTML = '';
        if (!candidates || candidates.length === 0) {
            candidateListContainer.innerHTML = '<p>공유된 맛집 정보가 없거나 잘못된 링크입니다.</p>';
            return;
        }
        candidates.forEach(candidate => {
            const item = document.createElement('label'); 
            item.className = 'candidate-item';
            item.dataset.id = candidate.id;
            item.innerHTML = `
                <input type="checkbox" class="vote-checkbox" data-id="${candidate.id}">
                <div class="custom-checkbox"></div>
                <div class="info">
                    <h5 class="place-name">${candidate.place_name}</h5>
                    <span class="address">${candidate.road_address_name || candidate.address_name}</span>
                </div>
                <div class="vote-result">
                    <div class="result-bar"></div>
                    <span class="vote-count"></span>
                </div>
            `;
            candidateListContainer.appendChild(item);
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('vote-checkbox') || e.target.classList.contains('custom-checkbox')) return;
                e.preventDefault();
                openPlacePopup(candidate.place_url);
            });
        });
    }

    // --- 툴팁 관련 함수 ---
    function showVoterTooltip(e) {
        const voters = e.currentTarget.dataset.voters;
        if (voters && voters.trim() !== '') {
            // 쉼표로 구분된 이름을 <br>로 연결하여 줄바꿈
            voterTooltip.innerHTML = voters.split(',').map(name => name.trim()).join('<br>');
            voterTooltip.style.display = 'block';
            moveVoterTooltip(e); // 초기 위치 설정
        }
    }

    function hideVoterTooltip() {
        voterTooltip.style.display = 'none';
    }

    function moveVoterTooltip(e) {
        // 툴팁이 화면 오른쪽을 벗어나지 않도록 처리
        const tooltipWidth = voterTooltip.offsetWidth;
        const xPos = e.pageX + 15;
        if (xPos + tooltipWidth > window.innerWidth) {
            voterTooltip.style.left = (e.pageX - tooltipWidth - 15) + 'px';
        } else {
            voterTooltip.style.left = xPos + 'px';
        }
        voterTooltip.style.top = (e.pageY + 15) + 'px';
    }

    function openPlacePopup(placeUrl) {
        if (!placeUrl || placeUrl.trim() === '') {
            alert('이 장소에 대한 상세 정보 URL이 제공되지 않았습니다.');
            return;
        }
        const popupWidth = 400;
        const popupHeight = 800;
        const popupX = window.screen.width - popupWidth;
        const popupY = (window.screen.height / 2) - (popupHeight / 2);
        const popupFeatures = `width=${popupWidth},height=${popupHeight},left=${popupX},top=${popupY},scrollbars=yes,resizable=yes`;
        window.open(placeUrl, 'place_details_popup', popupFeatures);
    }

    function createSeededRandom(seed) {
        let state = seed;
        return function() {
            // Simple LCG PRNG
            state = (state * 9301 + 49297) % 233280;
            return state / 233280.0;
        };
    }

    function applyTextPrimaryStyle() {
        const elements = document.querySelectorAll('.btn-text-primary');
        elements.forEach(el => {
            el.style.background = 'none';
            el.style.border = 'none';
            el.style.color = '#0d6efd';
            el.style.textDecoration = 'underline';
            el.style.cursor = 'pointer';
            el.style.fontSize = '16px';
            el.style.fontWeight = '700';
            el.style.padding = '8px';
        });
    }

    function initializeVoteApp() {
        const urlParams = new URLSearchParams(window.location.search);
        const data = urlParams.get('data');
        storageKey = data ? 'voteState_' + data : '';
        
        candidatesData = getCandidatesFromURL();
        if (candidatesData.length === 0) {
            // 후보 정보가 없으면 닉네임 입력란 숨기고 메시지 표시
            nicknameSection.style.display = 'none';
            votePageSection.style.display = 'block';
            candidateListContainer.innerHTML = '<p>공유된 맛집 정보가 없거나 잘못된 링크입니다.</p>';
            document.querySelector('#vote-guide-text').style.display = 'none';
            document.querySelector('.vote-actions').style.display = 'none';
        }

        createVoterTooltip();
        applyTextPrimaryStyle();
        voteTitle.style.marginBottom = '24px';
    }

    function renderResults(state) {
        votePageSection.classList.add('results-mode');
        voteTitle.textContent = '투표 결과';
        resultDescription.innerHTML = `
            <li>다른 분들도 투표 중일 거에요. 나중에 결과를 확인해 보세요.</li>
            <li>투표가 마무리 되기 전에 다시 선택지를 바꿀 수도 있어요.</li>
        `;
        voteTitle.style.textAlign = 'left';

        // 1. 최종 투표자 목록 집계
        const finalVoteData = {};
        candidatesData.forEach(c => {
            finalVoteData[c.id] = { voters: [] };
        });

        // 실제 사용자 투표
        for (const name in state.voters) {
            state.voters[name].forEach(placeId => {
                if (finalVoteData[placeId]) finalVoteData[placeId].voters.push(name);
            });
        }
        // 시뮬레이션된 투표
        for (const name in state.simulatedVoters) {
            const placeId = state.simulatedVoters[name];
            if (finalVoteData[placeId]) finalVoteData[placeId].voters.push(name);
        }

        // 2. 득표수 계산 및 UI 업데이트
        let maxVotes = 0;
        candidatesData.forEach(c => {
            const result = finalVoteData[c.id];
            result.totalVotes = result.voters.length;
            if (result.totalVotes > maxVotes) maxVotes = result.totalVotes;
        });

        displayCandidates(candidatesData); // 결과 표시를 위해 목록을 다시 그림

        candidatesData.forEach(c => {
            const result = finalVoteData[c.id];
            const item = document.querySelector(`.candidate-item[data-id="${c.id}"]`);
            if (!item) return;

            const countSpan = item.querySelector('.vote-count');
            const resultBar = item.querySelector('.result-bar');
            
            countSpan.textContent = result.totalVotes;
            resultBar.style.width = maxVotes > 0 ? (result.totalVotes / maxVotes) * 100 + '%' : '0%';
            item.dataset.voters = result.voters.join(', ');

            if (result.totalVotes > 0) {
                item.addEventListener('mouseover', showVoterTooltip);
                item.addEventListener('mouseout', hideVoterTooltip);
                item.addEventListener('mousemove', moveVoterTooltip);
            }
        });

        submitVoteBtn.style.display = 'none';
        showResultButtons();
    }

    function resetVote() {
        votePageSection.classList.remove('results-mode');
        
        // localStorage에서 현재 사용자 투표 기록만 제거
        if (voteState.voters[userNickname]) {
            delete voteState.voters[userNickname];
            localStorage.setItem(storageKey, JSON.stringify(voteState));
        }

        userSelections.clear(); // 현재 세션의 선택 기록 초기화

        // 투표 화면으로 UI 리셋
        voteTitle.textContent = '가고 싶은 곳에 투표';
        resultDescription.innerHTML = '';
        voteTitle.style.textAlign = 'left';
        
        document.querySelectorAll('.candidate-item').forEach(item => {
            item.removeEventListener('mouseover', showVoterTooltip);
            item.removeEventListener('mouseout', hideVoterTooltip);
            item.removeEventListener('mousemove', moveVoterTooltip);
            item.removeAttribute('data-voters');
        });

        displayCandidates(candidatesData); // 투표 목록 다시 표시
        
        voteActions.innerHTML = '';
        voteActions.appendChild(submitVoteBtn);
        submitVoteBtn.style.display = 'inline-block';
        applyTextPrimaryStyle(); 
    }

    function showResultButtons() {
        voteActions.innerHTML = ''; 

        const backBtn = document.createElement('button');
        backBtn.id = 'back-to-main-btn';
        backBtn.className = 'light-text-btn';
        backBtn.innerHTML = `<img src="image/icon.png" alt="home icon" class="btn-icon"> 우리 뭐 먹지`;
        backBtn.addEventListener('click', () => { window.location.href = 'index.html'; });

        const retryBtn = document.createElement('button');
        retryBtn.id = 'retry-vote-btn';
        retryBtn.className = 'btn-text-primary';
        retryBtn.textContent = '다시 투표하기';
        retryBtn.addEventListener('click', resetVote);
        
        voteActions.appendChild(backBtn);
        voteActions.appendChild(retryBtn);
        applyTextPrimaryStyle(); 
    }

    nicknameForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const nickname = nicknameInput.value.trim();
        if (nickname === '') {
            alert('이름(또는 별명)을 입력해주세요.');
            return;
        }

        const storedState = localStorage.getItem(storageKey);
        voteState = storedState ? JSON.parse(storedState) : { voters: {}, simulatedVoters: {} };

        userNickname = nickname;
        nicknameSection.style.display = 'none';
        votePageSection.style.display = 'block';

        if (voteState.voters[nickname]) {
            // 이미 투표한 경우, 바로 결과 표시
            renderResults(voteState);
        } else {
            // 처음 투표하는 경우, 투표 화면 표시
            displayCandidates(candidatesData);
        }
    });

    submitVoteBtn.addEventListener('click', function() {
        // 투표 완료 시, 현재 상태를 다시 읽어옴
        const currentState = localStorage.getItem(storageKey) 
            ? JSON.parse(localStorage.getItem(storageKey))
            : { voters: {}, simulatedVoters: {} };

        // 최초 투표 시에만 가상 투표자 생성
        if (Object.keys(currentState.simulatedVoters).length === 0) {
            // storageKey를 기반으로 시드 생성하여 결과 고정
            const seed = storageKey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const seededRandom = createSeededRandom(seed);
            
            const fakeVoters = ['김민준', '이서연', '박도윤', '최지우', '정시우', '강하은', '조민서', '윤지아', '임도현', '송예나'];
            fakeVoters.forEach(voter => {
                if (candidatesData.length > 0) {
                    const randomIndex = Math.floor(seededRandom() * candidatesData.length);
                    const votedCandidateId = candidatesData[randomIndex].id;
                    currentState.simulatedVoters[voter] = votedCandidateId;
                }
            });
        }
        
        // 현재 사용자 투표 정보 추가 또는 갱신
        currentState.voters[userNickname] = Array.from(userSelections);

        // localStorage에 최종 상태 저장
        localStorage.setItem(storageKey, JSON.stringify(currentState));

        // 결과 렌더링
        renderResults(currentState);
    });

    candidateListContainer.addEventListener('change', function(e) {
        if (e.target.classList.contains('vote-checkbox')) {
            const checkbox = e.target;
            const candidateId = checkbox.dataset.id;
            if (checkbox.checked) {
                userSelections.add(candidateId);
            } else {
                userSelections.delete(candidateId);
            }
        }
    });

    // 페이지 초기화 실행
    initializeVoteApp(); 
}); 