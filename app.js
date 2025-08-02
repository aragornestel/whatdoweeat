// 전역 변수 선언
let map;
let markers = [];
let currentPlaces = []; // 현재 검색 결과를 저장할 배열
let ballotBox = []; // 투표함에 담긴 장소를 저장할 배열
let infowindow; // 정보창을 저장할 변수
let currentVoteId = null; // 현재 투표 ID
let voteCandidates = []; // 투표 후보 목록
let voteResults = {}; // 투표 결과를 저장할 객체
let markerInfoMap = new Map(); // 마커와 인포윈도우 정보를 연결하는 맵

document.addEventListener('DOMContentLoaded', function () {
    const KAKAO_JS_KEY = '083df200276ca2cba88ee3db6ebbc2c1';
    
    // 1. 스크립트를 동적으로 생성하고, 로딩이 완료되면 initMap 함수를 호출합니다.
    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&libraries=services&autoload=false`;
    script.onload = () => {
        kakao.maps.load(() => {
            initMap();
        });
    };
    document.head.appendChild(script);
});

function initMap() {
    // 2. Geolocation API를 사용하여 현재 위치를 먼저 가져옵니다.
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                initializeMap(new kakao.maps.LatLng(lat, lng));
            },
            (error) => {
                console.error("Geolocation error: ", error);
                initializeMap(new kakao.maps.LatLng(37.566826, 126.9786567)); // 기본 위치: 서울시청
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    } else {
        console.log("Geolocation is not supported by this browser.");
        initializeMap(new kakao.maps.LatLng(37.566826, 126.9786567));
    }
}

function initializeMap(centerPosition) {
    const mapContainer = document.getElementById('map');
    const mapOptions = {
        center: centerPosition,
        level: 3 // 카카오맵의 확대 레벨
    };
    map = new kakao.maps.Map(mapContainer, mapOptions);
    
    // infowindow 초기화
    infowindow = new kakao.maps.InfoWindow({
        disableAutoPan: true,
        zIndex: 1000, // 더 높은 zIndex 설정
        removable: false, // 자동으로 제거되지 않도록
        closeButton: false // 닫기 버튼 제거
    });

    // 검색 버튼 이벤트 리스너 설정
    document.getElementById('search-btn').addEventListener('click', searchPlaces);

    // 검색창에서 엔터 키 입력 시 검색 실행
    document.getElementById('keyword').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            searchPlaces();
        }
    });

    // 바텀시트 닫기/열기 버튼 이벤트 리스너 설정
    const resultSheet = document.getElementById('result-sheet');
    const closeBtn = document.getElementById('close-sheet-btn');
    const reopenBtn = document.getElementById('reopen-sheet-btn');
    const mainElement = document.querySelector('main');

    closeBtn.addEventListener('click', () => {
        resultSheet.classList.remove('visible');
        reopenBtn.classList.add('visible');
        mainElement.classList.remove('search-active');
    });

    reopenBtn.addEventListener('click', () => {
        resultSheet.classList.add('visible');
        reopenBtn.classList.remove('visible');
        mainElement.classList.add('search-active');
    });

    // 모달 관련 요소 및 이벤트 리스너 설정
    const modal = document.getElementById('place-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    const closeModal = () => {
        modal.classList.remove('visible');
        const iframe = document.getElementById('place-iframe');
        iframe.src = 'about:blank'; // iframe 내용 비우기
    };

    modalCloseBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    // 투표 관련 모달 이벤트 리스너 설정
    setupVoteModals();
}

async function searchPlaces() {
    // 지도 객체가 준비되지 않았으면 검색을 막습니다.
    if (!map) {
        console.warn("Map is not ready yet.");
        return;
    }

    const keyword = document.getElementById('keyword').value.trim();
    if (!keyword) {
        alert('검색어를 입력해주세요.');
        return;
    }

    const searchBtn = document.getElementById('search-btn');
    searchBtn.disabled = true;
    searchBtn.textContent = '검색 중...';

    // 현재 지도 영역의 좌표를 얻어옵니다.
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest(); // 남서쪽 좌표
    const ne = bounds.getNorthEast(); // 북동쪽 좌표
    const rect = `${sw.getLng()},${sw.getLat()},${ne.getLng()},${ne.getLat()}`;

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const apiBaseUrl = isLocal
        ? 'http://127.0.0.1:5001/whatdoweeat-vibe/us-central1/api'
        : 'https://api-762xdud6eq-uc.a.run.app';

    try {
        const response = await fetch(`${apiBaseUrl}/search?query=${keyword}&rect=${rect}`);
        if (!response.ok) {
            throw new Error('API 호출에 실패했습니다.');
        }
        currentPlaces = await response.json();

        if (currentPlaces.length === 0) {
            alert('검색 결과가 없습니다.');
        }
    } catch (error) {
        console.error('Search error:', error);
        alert('검색 중 오류가 발생했습니다.');
        currentPlaces = [];
    } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = '검색';
    }

    document.getElementById('result-count').textContent = `'${keyword}' 검색 결과 (${currentPlaces.length}개)`;
    document.getElementById('reopen-sheet-btn').textContent = `${keyword}' 검색 결과 (${currentPlaces.length}개)`;
    
    displayPlaces(currentPlaces);

    document.getElementById('result-sheet').classList.add('visible');
    document.getElementById('reopen-sheet-btn').classList.remove('visible');
    document.querySelector('main').classList.add('search-active');
}

function displayPlaces(places) {
    const resultList = document.getElementById('result-list');
    resultList.innerHTML = '';
    removeMarkers();
    
    if (infowindow) {
        infowindow.close();
    }

    if (places.length === 0) {
        resultList.innerHTML = '<div class="no-result">검색 결과가 없습니다.</div>';
        return;
    }

    const bounds = new kakao.maps.LatLngBounds();

    places.forEach((place, index) => {
        const placePosition = new kakao.maps.LatLng(place.y, place.x);

        const marker = new kakao.maps.Marker({
            position: placePosition,
            map: map,
            title: place.place_name
        });
        
        // 마커에 place.id 저장
        marker.placeId = place.id;

        markers.push(marker);

        const listItem = document.createElement('div');
        listItem.className = 'result-item';
        listItem.dataset.placeId = place.id; // placeId 설정
        listItem.innerHTML = `
            <div class="result-item-info">
                <h5>${place.place_name}</h5>
                <p>${place.road_address_name || place.address_name}</p>
            </div>
            <button class="add-to-ballot-btn">담기</button>
        `;
        resultList.appendChild(listItem);

        const infoDiv = listItem.querySelector('.result-item-info');
        const addToBallotBtn = listItem.querySelector('.add-to-ballot-btn');

        // 이 장소가 이미 투표함에 있는지 확인하고 버튼 상태 업데이트
        if (ballotBox.some(item => item.id === place.id)) {
            addToBallotBtn.textContent = '빼기';
            addToBallotBtn.classList.add('added');
            // 투표함에 있는 장소라면 인포윈도우 표시
            markerInfoMap.set(place.id, { marker, placeName: place.place_name });
            console.log('검색 결과에서 투표함 장소 발견:', place.place_name);
            showMarkerInfo(place.id);
        }

        // 투표함 버튼 클릭 이벤트
        addToBallotBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 이벤트 버블링 중단
            toggleBallotBoxItem(place, addToBallotBtn);
        });
        
        const showInfoWindow = () => {
            // hover 시에는 항상 인포윈도우 표시
            // 간단한 텍스트만 전달 (CSS로 스타일링)
            infowindow.setContent(place.place_name);
            infowindow.open(map, marker);
        };
        
        const hideInfoWindow = () => {
            // hover 시에는 항상 인포윈도우 숨김
            infowindow.close();
        };

        kakao.maps.event.addListener(marker, 'mouseover', showInfoWindow);
        kakao.maps.event.addListener(marker, 'mouseout', hideInfoWindow);
        infoDiv.addEventListener('mouseover', showInfoWindow);
        infoDiv.addEventListener('mouseout', hideInfoWindow);

        const openModal = () => {
            const modal = document.getElementById('place-modal');
            const modalPlaceName = document.getElementById('modal-place-name');
            const iframe = document.getElementById('place-iframe');

            modalPlaceName.textContent = place.place_name;
            iframe.src = place.place_url.replace('http://', 'https://');
            modal.classList.add('visible');
        };

        kakao.maps.event.addListener(marker, 'click', openModal);
        infoDiv.addEventListener('click', openModal);

        bounds.extend(placePosition);
    });

    if (places.length > 0) {
        map.setBounds(bounds);
    }
}



function removeMarkers() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    // markerInfoMap.clear(); // 투표함에 담긴 장소 정보는 유지
}

// 마커 정보 제거 함수
function removeMarkerInfo(placeId) {
    const markerInfo = markerInfoMap.get(placeId);
    if (markerInfo) {
        hideMarkerInfo(placeId);
        markerInfoMap.delete(placeId);
    }
}

// 마커 정보 표시 함수
function showMarkerInfo(placeId) {
    const markerInfo = markerInfoMap.get(placeId);
    console.log('showMarkerInfo 호출됨:', placeId, markerInfo ? '정보있음' : '정보없음');
    if (markerInfo && infowindow) {
        console.log('인포윈도우 표시 시도:', markerInfo.placeName);
        
        // 현재 열린 인포윈도우 확인
        console.log('현재 인포윈도우 상태:', infowindow.getMap() ? '열림' : '닫힘');
        
        // 간단한 텍스트만 전달 (CSS로 스타일링)
        infowindow.setContent(markerInfo.placeName);
        infowindow.open(map, markerInfo.marker);
        
        // 인포윈도우 생성 후 DOM 요소 확인
        setTimeout(() => {
            // 카카오맵 인포윈도우만 정확히 찾기
            const kakaoInfoWindows = document.querySelectorAll('div[class*="kakao"], div[class*="Kakao"], div[class*="map"], div[class*="Map"]');
            console.log('카카오맵 관련 요소들:', kakaoInfoWindows.length, '개');
            kakaoInfoWindows.forEach((el, index) => {
                console.log(`카카오맵 요소 ${index + 1}:`, el.className, el.style.cssText);
            });
            
            // 모든 div 요소 중에서 인포윈도우처럼 보이는 것들 찾기
            const allDivs = document.querySelectorAll('div');
            const infoWindowLike = Array.from(allDivs).filter(div => 
                div.style.position === 'absolute' && 
                (div.style.zIndex > 0 || div.className.includes('info') || div.className.includes('Info'))
            );
            console.log('인포윈도우처럼 보이는 요소들:', infoWindowLike.length, '개');
            infoWindowLike.forEach((el, index) => {
                console.log(`인포윈도우같은 요소 ${index + 1}:`, el.className, el.style.cssText);
            });
        }, 100);
        
        console.log('인포윈도우 표시 완료');
    } else {
        console.log('인포윈도우 표시 실패:', !markerInfo ? '마커정보없음' : 'infowindow없음');
    }
}

// 마커 정보 숨김 함수
function hideMarkerInfo(placeId) {
    const markerInfo = markerInfoMap.get(placeId);
    if (markerInfo && infowindow && infowindow.getMap() && infowindow.getPosition().equals(markerInfo.marker.getPosition())) {
        infowindow.close();
    }
}

function toggleBallotBoxItem(place, button) {
    const index = ballotBox.findIndex(item => item.id === place.id);
    if (index > -1) {
        ballotBox.splice(index, 1);
        button.textContent = '담기';
        button.classList.remove('added');
        removeMarkerInfo(place.id); // 투표함에서 제거되면 인포윈도우도 제거
        console.log('투표함에서 제거됨:', place.place_name);
    } else {
        ballotBox.push(place);
        button.textContent = '빼기';
        button.classList.add('added');
        // 투표함에 추가되면 인포윈도우 표시
        const marker = markers.find(m => m.placeId === place.id);
        console.log('마커 찾기 결과:', marker ? '찾음' : '못찾음', place.place_name);
        console.log('찾으려는 placeId:', place.id);
        console.log('현재 마커들:', markers.length, '개');
        if (marker) {
            markerInfoMap.set(place.id, { marker, placeName: place.place_name });
            console.log('마커 정보 저장됨:', place.id, place.place_name);
            showMarkerInfo(place.id);
        }
    }
    updateBallotBoxButton();
}

function updateBallotBoxButton() {
    const ballotBoxBtn = document.getElementById('ballot-box-btn');
    if (ballotBox.length > 0) {
        ballotBoxBtn.style.display = 'block';
        ballotBoxBtn.textContent = `${ballotBox.length}개 장소 선택`;
    } else {
        ballotBoxBtn.style.display = 'none';
    }
}

function setupVoteModals() {
    const ballotBoxBtn = document.getElementById('ballot-box-btn');
    const ballotCandidatesModal = document.getElementById('ballot-candidates-modal');
    const votePollModal = document.getElementById('vote-poll-modal');
    
    // 투표 후보 리스트 모달 관련
    const ballotCandidatesCloseBtn = document.getElementById('ballot-candidates-close-btn');
    const creatorNameInput = document.getElementById('creator-name');
    const shareVoteBtn = document.getElementById('share-vote-btn');
    
    // 투표 화면 모달 관련
    const votePollCloseBtn = document.getElementById('vote-poll-close-btn');
    const voterNameInput = document.getElementById('voter-name');
    const submitVoteBtn = document.getElementById('submit-vote-btn');
    
    // GNB 버튼 클릭 시 투표 후보 리스트 모달 열기
    ballotBoxBtn.addEventListener('click', () => {
        openBallotCandidatesModal();
    });
    
    // 투표 후보 리스트 모달 닫기
    ballotCandidatesCloseBtn.addEventListener('click', () => {
        ballotCandidatesModal.classList.remove('visible');
        creatorNameInput.value = '';
    });
    
    // 투표 후보 리스트 모달 바깥 클릭 시 닫기
    ballotCandidatesModal.addEventListener('click', (event) => {
        if (event.target === ballotCandidatesModal) {
            ballotCandidatesModal.classList.remove('visible');
            creatorNameInput.value = '';
        }
    });
    
    // 공유하기 버튼 클릭 시 투표 링크 생성
    shareVoteBtn.addEventListener('click', () => {
        const creatorName = creatorNameInput.value.trim();
        if (creatorName && voteCandidates.length > 0) {
            createVoteLink(creatorName);
        } else {
            alert('이름을 입력하고 후보를 선택해주세요.');
        }
    });
    
    // 투표 화면 모달 닫기
    votePollCloseBtn.addEventListener('click', () => {
        votePollModal.classList.remove('visible');
        voterNameInput.value = '';
    });
    
    // 투표 화면 모달 바깥 클릭 시 닫기
    votePollModal.addEventListener('click', (event) => {
        if (event.target === votePollModal) {
            votePollModal.classList.remove('visible');
            voterNameInput.value = '';
        }
    });
    
    // 투표 완료 버튼 클릭 시 투표 제출
    submitVoteBtn.addEventListener('click', () => {
        const voterName = voterNameInput.value.trim();
        if (voterName) {
            submitVote(voterName);
        } else {
            alert('투표자 이름을 입력해주세요.');
        }
    });
    
    // 엔터 키로 투표 제출
    voterNameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            submitVoteBtn.click();
        }
    });
}

function openBallotCandidatesModal() {
    const ballotCandidatesModal = document.getElementById('ballot-candidates-modal');
    const ballotCandidatesList = document.getElementById('ballot-candidates-list');
    
    ballotCandidatesList.innerHTML = '';
    voteCandidates = [...ballotBox]; // ballotBox를 복사
    
    voteCandidates.forEach((place) => {
        const candidateItem = document.createElement('div');
        candidateItem.className = 'ballot-candidate-item';
        candidateItem.dataset.placeId = place.id; // placeId 설정
        candidateItem.innerHTML = `
            <div class="ballot-candidate-item-info">
                <h5>${place.place_name}</h5>
                <p>${place.road_address_name || place.address_name}</p>
            </div>
            <button class="remove-candidate-btn">×</button>
        `;
        ballotCandidatesList.appendChild(candidateItem);
        
        // 제외 버튼 클릭 이벤트 (ID 기반으로 변경)
        const removeBtn = candidateItem.querySelector('.remove-candidate-btn');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeCandidateById(place.id, candidateItem);
        });
        
        // 장소 정보 클릭 이벤트
        const infoDiv = candidateItem.querySelector('.ballot-candidate-item-info');
        infoDiv.addEventListener('click', () => {
            showPlaceInfo(place);
        });
    });
    
    ballotCandidatesModal.classList.add('visible');
}

function removeCandidateById(placeId, itemElement) {
    // ID 기반으로 삭제
    voteCandidates = voteCandidates.filter(candidate => candidate.id !== placeId);
    itemElement.classList.add('removed');
    itemElement.style.display = 'none';
    
    // ballotBox에서도 제거
    const ballotIndex = ballotBox.findIndex(ballotItem => ballotItem.id === placeId);
    if (ballotIndex > -1) {
        ballotBox.splice(ballotIndex, 1);
    }
    
    // 바텀시트의 버튼 상태 업데이트
    updateBottomSheetButtons();
    
    // GNB 버튼 업데이트
    updateBallotBoxButton();
    
    // 마커 정보 제거
    removeMarkerInfo(placeId);
}

function updateBottomSheetButtons() {
    // 바텀시트의 모든 버튼 상태 업데이트
    const resultItems = document.querySelectorAll('.result-item');
    resultItems.forEach(resultItem => {
        const addToBallotBtn = resultItem.querySelector('.add-to-ballot-btn');
        const placeId = resultItem.dataset.placeId;
        
        if (addToBallotBtn && placeId) {
            const isInBallotBox = ballotBox.some(ballotItem => ballotItem.id === placeId);
            if (isInBallotBox) {
                addToBallotBtn.textContent = '빼기';
                addToBallotBtn.classList.add('added');
            } else {
                addToBallotBtn.textContent = '담기';
                addToBallotBtn.classList.remove('added');
            }
        }
    });
}

function showPlaceInfo(place) {
    const modal = document.getElementById('place-modal');
    const modalPlaceName = document.getElementById('modal-place-name');
    const iframe = document.getElementById('place-iframe');

    modalPlaceName.textContent = place.place_name;
    iframe.src = place.place_url.replace('http://', 'https://');
    modal.classList.add('visible');
}

function createVoteLink(creatorName) {
    // 간단한 투표 ID 생성 (실제로는 서버에서 생성해야 함)
    const voteId = 'vote_' + Date.now();
    currentVoteId = voteId;
    
    // 투표 데이터 저장 (실제로는 서버에 저장해야 함)
    voteResults[voteId] = {
        creatorName,
        candidates: voteCandidates,
        votes: []
    };
    
    // 투표 링크 생성
    const voteLink = `${window.location.origin}${window.location.pathname}?vote=${voteId}`;
    
    // 링크 복사
    navigator.clipboard.writeText(voteLink).then(() => {
        alert(`투표 링크가 클립보드에 복사되었습니다!\n\n${voteLink}`);
    }).catch(() => {
        // 클립보드 복사 실패 시 링크 표시
        alert(`투표 링크:\n\n${voteLink}`);
    });
    
    // 모달 닫기
    document.getElementById('ballot-candidates-modal').classList.remove('visible');
    document.getElementById('creator-name').value = '';
}

function openVotePollModal(voteId) {
    const votePollModal = document.getElementById('vote-poll-modal');
    const votePollList = document.getElementById('vote-poll-list');
    const votePollTitle = document.getElementById('vote-poll-title');
    
    const voteData = voteResults[voteId];
    if (!voteData) {
        alert('투표를 찾을 수 없습니다.');
        return;
    }
    
    votePollTitle.textContent = `${voteData.creatorName}님이 만든 투표`;
    votePollList.innerHTML = '';
    
    voteData.candidates.forEach((place) => {
        const voteItem = document.createElement('div');
        voteItem.className = 'vote-poll-item';
        voteItem.innerHTML = `
            <div class="vote-poll-item-info">
                <h5>${place.place_name}</h5>
                <p>${place.road_address_name || place.address_name}</p>
            </div>
            <div class="vote-poll-buttons">
                <button class="vote-poll-btn yes" data-place-id="${place.id}">👍 좋아요</button>
                <button class="vote-poll-btn no" data-place-id="${place.id}">👎 싫어요</button>
            </div>
        `;
        votePollList.appendChild(voteItem);
        
        // 투표 버튼 이벤트 리스너
        const yesBtn = voteItem.querySelector('.vote-poll-btn.yes');
        const noBtn = voteItem.querySelector('.vote-poll-btn.no');
        
        yesBtn.addEventListener('click', () => {
            yesBtn.classList.add('selected');
            noBtn.classList.remove('selected');
        });
        
        noBtn.addEventListener('click', () => {
            noBtn.classList.add('selected');
            yesBtn.classList.remove('selected');
        });
        
        // 장소 정보 클릭 이벤트
        const infoDiv = voteItem.querySelector('.vote-poll-item-info');
        infoDiv.addEventListener('click', () => {
            showPlaceInfo(place);
        });
    });
    
    votePollModal.classList.add('visible');
}

function submitVote(voterName) {
    const voteItems = document.querySelectorAll('.vote-poll-item');
    const currentVotes = [];
    
    voteItems.forEach((item) => {
        const placeId = item.querySelector('.vote-poll-btn').dataset.placeId;
        const placeName = item.querySelector('h5').textContent;
        const yesBtn = item.querySelector('.vote-poll-btn.yes');
        const noBtn = item.querySelector('.vote-poll-btn.no');
        
        let vote = null;
        if (yesBtn.classList.contains('selected')) {
            vote = 'yes';
        } else if (noBtn.classList.contains('selected')) {
            vote = 'no';
        }
        
        if (vote) {
            currentVotes.push({
                placeId,
                placeName,
                vote,
                voterName
            });
        }
    });
    
    if (currentVotes.length === 0) {
        alert('모든 장소에 대해 투표해주세요.');
        return;
    }
    
    // 투표 결과 저장
    if (voteResults[currentVoteId]) {
        voteResults[currentVoteId].votes.push(...currentVotes);
    }
    
    // 투표 완료 메시지
    alert('투표가 완료되었습니다!');
    
    // 모달 닫기
    document.getElementById('vote-poll-modal').classList.remove('visible');
    document.getElementById('voter-name').value = '';
}

// URL 파라미터 확인하여 투표 링크로 접속했는지 확인
function checkVoteLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const voteId = urlParams.get('vote');
    
    if (voteId) {
        currentVoteId = voteId;
        openVotePollModal(voteId);
    }
}

// 페이지 로드 시 투표 링크 확인
document.addEventListener('DOMContentLoaded', function() {
    // 기존 DOMContentLoaded 이벤트 리스너 내용...
    
    // 투표 링크 확인
    setTimeout(checkVoteLink, 1000); // 지도 로딩 후 확인
});