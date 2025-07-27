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
    let pollId = ''; 
    let voteState = {};

    // 페이지 로드 시 툴팁 엘리먼트를 한 번만 생성
    function createVoterTooltip() {
        voterTooltip = document.createElement('div');
        voterTooltip.className = 'voter-tooltip';
        voterTooltip.style.display = 'none';
        document.body.appendChild(voterTooltip);
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

    async function initializeVoteApp() {
        const urlParams = new URLSearchParams(window.location.search);
        pollId = urlParams.get('pollId');
        
        if (!pollId) {
            showError('잘못된 접근입니다. 투표 링크를 다시 확인해주세요.');
            return;
        }

        try {
            const response = await fetch(`/api/polls/${pollId}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: '투표 정보를 불러오는데 실패했습니다.' }));
                throw new Error(errorData.error || 'Failed to fetch poll data');
            }
            const data = await response.json();
            candidatesData = data.candidates;
            voteState = { voters: data.votes || {} };

            createVoterTooltip();
            applyTextPrimaryStyle();
            voteTitle.style.marginBottom = '24px';
            
        } catch (error) {
            console.error('Initialization error:', error);
            showError(error.message);
        }
    }

    function showError(message) {
        nicknameSection.style.display = 'none';
        votePageSection.style.display = 'block';
        candidateListContainer.innerHTML = `<p>${message}</p>`;
        document.getElementById('vote-guide-text').style.display = 'none';
        document.querySelector('.vote-actions').style.display = 'none';
    }

    function renderResults(state) {
        votePageSection.classList.add('results-mode');
        voteTitle.textContent = '투표 결과';
        resultDescription.innerHTML = `
            <li>투표가 완료되었습니다. 다른 친구들의 결과도 확인해보세요.</li>
            <li>결과가 마음에 들지 않으면, '다시 투표하기'로 선택을 바꿀 수 있습니다.</li>
        `;
        voteTitle.style.textAlign = 'left';

        const finalVoteData = {};
        candidatesData.forEach(c => {
            finalVoteData[c.id] = { voters: [] };
        });

        for (const name in state.voters) {
            state.voters[name].forEach(placeId => {
                if (finalVoteData[placeId]) {
                    finalVoteData[placeId].voters.push(name);
                }
            });
        }
        
        let maxVotes = 0;
        candidatesData.forEach(c => {
            const result = finalVoteData[c.id];
            result.totalVotes = result.voters.length;
            if (result.totalVotes > maxVotes) maxVotes = result.totalVotes;
        });

        displayCandidates(candidatesData);

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
        userSelections.clear();
        voteTitle.textContent = '가고 싶은 곳에 투표';
        resultDescription.innerHTML = '';
        voteTitle.style.textAlign = 'left';
        
        document.querySelectorAll('.candidate-item').forEach(item => {
            item.removeEventListener('mouseover', showVoterTooltip);
            item.removeEventListener('mouseout', hideVoterTooltip);
            item.removeEventListener('mousemove', moveVoterTooltip);
            item.removeAttribute('data-voters');
        });

        displayCandidates(candidatesData);
        
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

        userNickname = nickname;
        nicknameSection.style.display = 'none';
        votePageSection.style.display = 'block';

        if (voteState.voters && voteState.voters[nickname]) {
            renderResults(voteState);
        } else {
            displayCandidates(candidatesData);
        }
    });

    submitVoteBtn.addEventListener('click', async function() {
        try {
            const selections = Array.from(userSelections);
            const response = await fetch('/api/votes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    pollId: pollId,
                    userName: userNickname,
                    selections: selections 
                }),
            });

            if (!response.ok) {
                throw new Error('투표 결과를 저장하는 데 실패했습니다.');
            }

            // 서버 저장이 성공하면, 현재 상태를 로컬에서 업데이트하고 결과를 바로 표시
            if (!voteState.voters) {
                voteState.voters = {};
            }
            voteState.voters[userNickname] = selections;
            renderResults(voteState);

        } catch (error) {
            console.error('Error submitting vote:', error);
            alert(error.message);
        }
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