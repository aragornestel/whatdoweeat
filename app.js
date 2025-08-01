// 전역 변수 선언
let map;
let markers = [];
let currentPlaces = []; // 현재 검색 결과를 저장할 배열
let ballotBox = []; // 투표함에 담긴 장소를 저장할 배열
let infowindow; // 정보창을 저장할 변수
let currentVoterName = ''; // 현재 투표자 이름
let voteResults = []; // 투표 결과를 저장할 배열

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

    infowindow = new kakao.maps.InfoWindow({
        disableAutoPan: true,
        zIndex: 1
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
    
    if (infowindow.getMap()) {
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

        markers.push(marker);

        const listItem = document.createElement('div');
        listItem.className = 'result-item';
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
        }

        // 투표함 버튼 클릭 이벤트
        addToBallotBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 이벤트 버블링 중단
            toggleBallotBoxItem(place, addToBallotBtn);
        });
        
        const showInfoWindow = () => {
            infowindow.setContent(`<div style="padding:5px;font-size:12px;">${place.place_name}</div>`);
            infowindow.open(map, marker);
        };
        
        const hideInfoWindow = () => {
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
}

function toggleBallotBoxItem(place, button) {
    const index = ballotBox.findIndex(item => item.id === place.id);
    if (index > -1) {
        ballotBox.splice(index, 1);
        button.textContent = '담기';
        button.classList.remove('added');
    } else {
        ballotBox.push(place);
        button.textContent = '빼기';
        button.classList.add('added');
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
    const nameInputModal = document.getElementById('name-input-modal');
    const voteModal = document.getElementById('vote-modal');
    const voteResultModal = document.getElementById('vote-result-modal');
    
    // 1단계: 이름 입력 모달 관련
    const nameInputCloseBtn = document.getElementById('name-input-close-btn');
    const voterNameInput = document.getElementById('voter-name');
    const nameSubmitBtn = document.getElementById('name-submit-btn');
    
    // 2단계: 투표 모달 관련
    const voteModalCloseBtn = document.getElementById('vote-modal-close-btn');
    const voteSubmitBtn = document.getElementById('vote-submit-btn');
    
    // 3단계: 투표 결과 모달 관련
    const voteResultCloseBtn = document.getElementById('vote-result-close-btn');
    const voteResultClose = document.getElementById('vote-result-close');
    
    // GNB 버튼 클릭 시 1단계 모달 열기
    ballotBoxBtn.addEventListener('click', () => {
        nameInputModal.classList.add('visible');
        voterNameInput.focus();
    });
    
    // 이름 입력 모달 닫기
    nameInputCloseBtn.addEventListener('click', () => {
        nameInputModal.classList.remove('visible');
        voterNameInput.value = '';
    });
    
    // 이름 입력 모달 바깥 클릭 시 닫기
    nameInputModal.addEventListener('click', (event) => {
        if (event.target === nameInputModal) {
            nameInputModal.classList.remove('visible');
            voterNameInput.value = '';
        }
    });
    
    // 이름 제출 버튼 클릭 시 2단계로 이동
    nameSubmitBtn.addEventListener('click', () => {
        const voterName = voterNameInput.value.trim();
        if (voterName) {
            currentVoterName = voterName;
            nameInputModal.classList.remove('visible');
            voterNameInput.value = '';
            openVoteModal();
        } else {
            alert('이름을 입력해주세요.');
        }
    });
    
    // 엔터 키로 이름 제출
    voterNameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            nameSubmitBtn.click();
        }
    });
    
    // 투표 모달 닫기
    voteModalCloseBtn.addEventListener('click', () => {
        voteModal.classList.remove('visible');
    });
    
    // 투표 모달 바깥 클릭 시 닫기
    voteModal.addEventListener('click', (event) => {
        if (event.target === voteModal) {
            voteModal.classList.remove('visible');
        }
    });
    
    // 투표 완료 버튼 클릭 시 3단계로 이동
    voteSubmitBtn.addEventListener('click', () => {
        submitVote();
    });
    
    // 투표 결과 모달 닫기
    voteResultCloseBtn.addEventListener('click', () => {
        voteResultModal.classList.remove('visible');
    });
    
    voteResultClose.addEventListener('click', () => {
        voteResultModal.classList.remove('visible');
    });
    
    // 투표 결과 모달 바깥 클릭 시 닫기
    voteResultModal.addEventListener('click', (event) => {
        if (event.target === voteResultModal) {
            voteResultModal.classList.remove('visible');
        }
    });
}

function openVoteModal() {
    const voteModal = document.getElementById('vote-modal');
    const voteItemsList = document.getElementById('vote-items-list');
    const voteModalTitle = document.getElementById('vote-modal-title');
    
    voteModalTitle.textContent = `${currentVoterName}님의 투표`;
    voteItemsList.innerHTML = '';
    
    ballotBox.forEach((place, index) => {
        const voteItem = document.createElement('div');
        voteItem.className = 'vote-item';
        voteItem.innerHTML = `
            <div class="vote-item-info">
                <h5>${place.place_name}</h5>
                <p>${place.road_address_name || place.address_name}</p>
            </div>
            <div class="vote-buttons">
                <button class="vote-btn yes" data-place-id="${place.id}" data-vote="yes">👍 좋아요</button>
                <button class="vote-btn no" data-place-id="${place.id}" data-vote="no">👎 싫어요</button>
            </div>
        `;
        voteItemsList.appendChild(voteItem);
        
        // 투표 버튼 이벤트 리스너
        const yesBtn = voteItem.querySelector('.vote-btn.yes');
        const noBtn = voteItem.querySelector('.vote-btn.no');
        
        yesBtn.addEventListener('click', () => {
            yesBtn.classList.add('selected');
            noBtn.classList.remove('selected');
        });
        
        noBtn.addEventListener('click', () => {
            noBtn.classList.add('selected');
            yesBtn.classList.remove('selected');
        });
    });
    
    voteModal.classList.add('visible');
}

function submitVote() {
    const voteItems = document.querySelectorAll('.vote-item');
    const currentVotes = [];
    
    voteItems.forEach((item) => {
        const placeId = item.querySelector('.vote-btn').dataset.placeId;
        const placeName = item.querySelector('h5').textContent;
        const placeAddress = item.querySelector('p').textContent;
        const yesBtn = item.querySelector('.vote-btn.yes');
        const noBtn = item.querySelector('.vote-btn.no');
        
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
                placeAddress,
                vote,
                voterName: currentVoterName
            });
        }
    });
    
    if (currentVotes.length === 0) {
        alert('모든 장소에 대해 투표해주세요.');
        return;
    }
    
    // 투표 결과를 전역 배열에 추가
    voteResults.push(...currentVotes);
    
    // 2단계 모달 닫고 3단계 모달 열기
    document.getElementById('vote-modal').classList.remove('visible');
    openVoteResultModal();
}

function openVoteResultModal() {
    const voteResultModal = document.getElementById('vote-result-modal');
    const voteResultList = document.getElementById('vote-result-list');
    
    voteResultList.innerHTML = '';
    
    // 투표 결과를 장소별로 그룹화
    const placeVotes = {};
    voteResults.forEach(vote => {
        if (!placeVotes[vote.placeId]) {
            placeVotes[vote.placeId] = {
                placeName: vote.placeName,
                placeAddress: vote.placeAddress,
                yesCount: 0,
                noCount: 0
            };
        }
        
        if (vote.vote === 'yes') {
            placeVotes[vote.placeId].yesCount++;
        } else {
            placeVotes[vote.placeId].noCount++;
        }
    });
    
    // 결과 표시
    Object.values(placeVotes).forEach(place => {
        const resultItem = document.createElement('div');
        resultItem.className = 'vote-result-item';
        resultItem.innerHTML = `
            <div class="vote-result-item-info">
                <h5>${place.placeName}</h5>
                <p>${place.placeAddress}</p>
            </div>
            <div class="vote-count">
                👍 ${place.yesCount} | 👎 ${place.noCount}
            </div>
        `;
        voteResultList.appendChild(resultItem);
    });
    
    voteResultModal.classList.add('visible');
} 