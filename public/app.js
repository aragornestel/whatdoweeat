document.addEventListener('DOMContentLoaded', function () {

    // --- 전역 변수 및 초기 설정 ---
    let map;
    let markers = [];
    let voteList = [];
    let currentInfowindow = null;

    const searchSection = document.getElementById('search-section');
    const searchForm = document.getElementById('search-form');
    const keywordInput = document.getElementById('keyword');
    const resultsSheet = document.getElementById('results-sheet');
    const resultsCountEl = document.getElementById('results-count');
    const closeSheetBtn = document.getElementById('close-sheet-btn');
    const resultsContainer = document.getElementById('results');
    const reopenSheetBtn = document.getElementById('reopen-sheet-btn');
    const voteModal = document.getElementById('vote-modal');
    const showVoteListBtn = document.getElementById('show-vote-list-btn');
    const voteCountSpan = document.getElementById('vote-count');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const voteListContainer = document.getElementById('vote-list');
    const createVoteLinkBtn = document.getElementById('create-vote-link-btn');
    const voteModalFooter = document.getElementById('vote-modal-footer');

    // 1. 서버에서 Naver Map Client ID를 가져와서 지도 초기화 시작
    fetch('/api/config')
        .then(response => response.json())
        .then(config => {
            if (!config.naverMapClientId) {
                throw new Error('Naver Map Client ID is missing in server response.');
            }
            // HTML의 스크립트 태그 src를 동적으로 변경하여 지도 SDK 로드
            const mapScript = document.querySelector('script[src*="ncpKeyId"]');
            mapScript.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${config.naverMapClientId}&submodules=geocoder`;
            
            mapScript.onload = startMapInitialization; // 스크립트 로드 완료 후 지도 초기화
        })
        .catch(error => {
            console.error("Map initialization failed:", error);
            alert("지도를 불러오는 데 실패했습니다.");
        });

    // --- 지도 초기화 ---
    function startMapInitialization() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function (position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                createMap(new naver.maps.LatLng(lat, lon));
            }, function (error) {
                console.error("Geolocation 오류: ", error.message);
                createMap(new naver.maps.LatLng(37.566826, 126.9786567)); // 기본 위치 (서울시청)
            });
        } else {
            createMap(new naver.maps.LatLng(37.566826, 126.9786567)); // 기본 위치 (서울시청)
        }
    }
    
    // 네이버 지도 SDK 스크립트가 로드 완료되면, 지도 초기화를 시작합니다.
    naver.maps.onJSContentLoaded = startMapInitialization;

    // --- 함수 정의 ---
    function createMap(centerPosition) {
        const mapOption = {
            center: centerPosition,
            zoom: 15,
            minZoom: 6
        };
        map = new naver.maps.Map('map', mapOption);
        setupEventListeners();
    }
    
    function setupEventListeners() {
        searchForm.addEventListener('submit', function (e) {
            e.preventDefault();
            searchPlaces();
        });

        closeSheetBtn.addEventListener('click', hideResultsSheet);
        reopenSheetBtn.addEventListener('click', showResultsSheet);
        showVoteListBtn.addEventListener('click', showVoteModal);
        closeModalBtn.addEventListener('click', hideVoteModal);
        createVoteLinkBtn.addEventListener('click', createVoteLink);
        voteModal.addEventListener('click', (e) => {
            if (e.target === voteModal) {
                hideVoteModal();
            }
        });
    }

    async function searchPlaces() {
        const keyword = keywordInput.value;
        if (!keyword.trim()) {
            alert('키워드를 입력해주세요!');
            return;
        }

        try {
            const response = await fetch(`/api/search?query=${encodeURIComponent(keyword)}`);
            const data = await response.json();

            if (data.items && data.items.length > 0) {
                resultsCountEl.innerHTML = `<span>'${keyword}' 검색 결과</span>`;
                reopenSheetBtn.textContent = `'${keyword}' 검색 결과 보기`;
                displayPlaces(data.items);
                showResultsSheet();
            } else {
                alert('검색 결과가 없습니다.');
                removeAllChildNods(resultsContainer);
                removeMarker();
            }
        } catch (error) {
            console.error('Search failed:', error);
            alert('검색 중 오류가 발생했습니다.');
        }
    }
    
    function displayPlaces(places) {
        removeAllChildNods(resultsContainer);
        removeMarker();
        if (currentInfowindow) currentInfowindow.close();
        
        const bounds = new naver.maps.LatLngBounds();

        places.forEach((place) => {
            const tm128Coord = new naver.maps.Point(place.mapx, place.mapy);
            const latlng = naver.maps.TransCoord.fromTM128ToLatLng(tm128Coord);
            
            const marker = addMarker(latlng);
            bounds.extend(latlng);

            const itemEl = getListItem(place);
            
            const infowindow = new naver.maps.InfoWindow({
                content: `<div class="infowindow-content">${place.title.replace(/<[^>]*>?/gm, '')}</div>`,
            });

            const showOverlay = () => {
                if(currentInfowindow) currentInfowindow.close();
                infowindow.open(map, marker);
                currentInfowindow = infowindow;
            };

            naver.maps.Event.addListener(marker, "mouseover", showOverlay);
            itemEl.addEventListener('mouseover', showOverlay);
            
            itemEl.addEventListener('click', (e) => {
                if (e.target.closest('.add-to-vote-btn')) {
                    e.stopPropagation(); return;
                }
                window.open(place.link, '_blank');
            });
            
            itemEl.querySelector('.add-to-vote-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const placeId = btoa(encodeURIComponent(place.title + place.address));
                if (voteList.some(item => item.id === placeId)) {
                    removeFromVoteList(placeId);
                } else {
                    addToVoteList({ ...place, id: placeId });
                }
            });

            resultsContainer.appendChild(itemEl);
        });
        map.fitBounds(bounds);
    }
    
    function getListItem(place) {
        const el = document.createElement('div');
        el.classList.add('item');
        
        const placeId = btoa(encodeURIComponent(place.title + place.address));
        const isAdded = voteList.some(item => item.id === placeId);
        const placeTitle = place.title.replace(/<[^>]*>?/gm, '');

        el.innerHTML = `
            <div class="item-content">
                <h5>${placeTitle}</h5>
                <span>${place.roadAddress || place.address}</span>
            </div>
            <button class="add-to-vote-btn ${isAdded ? 'added' : ''}" title="${isAdded ? '목록에서 제거' : '투표 목록에 추가'}" data-place-id="${placeId}">
                ${isAdded ? '✓' : '+'}
            </button>
        `;
        return el;
    }
    
    function addMarker(position) {
        const marker = new naver.maps.Marker({ position, map });
        markers.push(marker);
        return marker;
    }

    function removeMarker() {
        markers.forEach(marker => marker.setMap(null));
        markers = [];
    }
    
    function showResultsSheet() {
        resultsSheet.classList.add('visible');
        searchSection.classList.add('is-searching');
        reopenSheetBtn.style.display = 'none';
    }

    function hideResultsSheet() {
        resultsSheet.classList.remove('visible');
        searchSection.classList.remove('is-searching');
        reopenSheetBtn.style.display = 'block';
    }

    function addToVoteList(place) {
        if (!voteList.some(item => item.id === place.id)) {
            voteList.push(place);
            renderVoteList();
            updateAddButtonState(place.id, true);
            updateVoteGnbButton();
        }
    }

    function removeFromVoteList(placeId) {
        voteList = voteList.filter(item => item.id !== placeId);
        renderVoteList();
        updateAddButtonState(placeId, false);
        updateVoteGnbButton();
    }

    function updateVoteGnbButton() {
        voteCountSpan.parentElement.style.display = voteList.length > 0 ? 'block' : 'none';
        voteCountSpan.textContent = voteList.length;
    }

    function renderVoteList() {
        voteListContainer.innerHTML = '';
        if (voteList.length === 0) {
            voteModalFooter.style.display = 'none';
            voteListContainer.innerHTML = `<div class="empty-vote-list"><p>선택한 맛집이 없습니다.</p><button id="go-back-to-select-btn" class="light-text-btn">다시 맛집 선택하러 가기</button></div>`;
            document.getElementById('go-back-to-select-btn').addEventListener('click', hideVoteModal);
            return;
        }
        voteModalFooter.style.display = 'block';
        const list = document.createElement('ul');
        list.className = 'vote-ul';
        voteList.forEach(place => {
            const placeTitle = place.title.replace(/<[^>]*>?/gm, '');
            const listItem = document.createElement('li');
            listItem.className = 'vote-item';
            listItem.innerHTML = `<span class="place-name">${placeTitle}</span><button class="remove-vote-btn" data-place-id="${place.id}" title="삭제">&times;</button>`;
            listItem.querySelector('.remove-vote-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                removeFromVoteList(place.id);
            });
            listItem.addEventListener('click', () => window.open(place.link, '_blank'));
            list.appendChild(listItem);
        });
        voteListContainer.appendChild(list);
    }
    
    function updateAddButtonState(placeId, isAdded) {
        const addButton = document.querySelector(`.add-to-vote-btn[data-place-id="${placeId}"]`);
        if (addButton) {
            addButton.textContent = isAdded ? '✓' : '+';
            addButton.title = isAdded ? '목록에서 제거' : '투표 목록에 추가';
            addButton.classList.toggle('added', isAdded);
        }
    }

    function showVoteModal() {
        if (resultsSheet.classList.contains('visible')) {
            hideResultsSheet();
            setTimeout(() => voteModal.style.display = 'flex', 400);
        } else {
            voteModal.style.display = 'flex';
        }
        renderVoteList();
    }

    function hideVoteModal() {
        voteModal.style.display = 'none';
    }

    function createVoteLink() {
        if (voteList.length === 0) return;
        const placesToShare = voteList.map(p => ({
            id: p.id,
            title: p.title.replace(/<[^>]*>?/gm, ''),
            address: p.address,
            roadAddress: p.roadAddress,
            link: p.link,
        }));
        
        fetch('/api/polls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candidates: placesToShare }),
        })
        .then(res => res.json())
        .then(data => {
            if (data.pollId) {
                const url = `${window.location.origin}/vote.html?pollId=${data.pollId}`;
                navigator.clipboard.writeText(url).then(() => alert('투표 링크가 클립보드에 복사되었습니다!'))
                .catch(() => prompt('아래 링크를 복사하여 공유하세요!', url));
            }
        })
        .catch(err => console.error('Error creating vote link:', err));
    }

    function removeAllChildNods(el) {
        while (el.hasChildNodes()) {
            el.removeChild(el.lastChild);
        }
    }
});