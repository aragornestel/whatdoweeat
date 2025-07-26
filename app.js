document.addEventListener('DOMContentLoaded', function () {

    function loadMapSDK() {
        const script = document.createElement('script');
        script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_API_KEY}&libraries=services&autoload=false`;
        document.head.appendChild(script);

        script.onload = () => {
            kakao.maps.load(() => {
                // --- 이 아래부터 모든 지도 관련 로직 시작 ---

                const mapContainer = document.getElementById('map');
                let map; 

                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(function(position) {
                        const lat = position.coords.latitude;
                        const lon = position.coords.longitude;
                        const locPosition = new kakao.maps.LatLng(lat, lon);
                        initializeMap(locPosition);
                    }, function(error) {
                        console.error("Geolocation 오류: ", error.message);
                        const defaultPosition = new kakao.maps.LatLng(37.566826, 126.9786567);
                        initializeMap(defaultPosition);
                    });
                } else {
                    const defaultPosition = new kakao.maps.LatLng(37.566826, 126.9786567);
                    initializeMap(defaultPosition);
                }
                
                function initializeMap(centerPosition) {
                    const mapOption = {
                        center: centerPosition,
                        level: 4
                    };
                    map = new kakao.maps.Map(mapContainer, mapOption);
                    setupMapFunctionality();
                }
                
                const ps = new kakao.maps.services.Places();
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
    
                let markers = [];
                let voteList = []; 
                let resultsSheetWasOpen = false; 
                let hideOverlayTimeout; 

                const customOverlay = new kakao.maps.CustomOverlay(null, {
                    zIndex: 1
                });

                function setupMapFunctionality() {
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

                function searchPlaces() {
                    const keyword = keywordInput.value;

                    if (!keyword.replace(/^\s+|\s+$/g, '')) {
                        alert('키워드를 입력해주세요!');
                        return false;
                    }

                    const searchOptions = {
                        bounds: map.getBounds(),
                        size: 5 
                    };

                    ps.keywordSearch(keyword, (data, status, pagination) => {
                        if (status === kakao.maps.services.Status.OK) {
                            resultsCountEl.innerHTML = `
                                <span>함께 먹고 싶은 곳을 선택해 주세요</span>
                                <img src="image/healthy-food.png" alt="음식 아이콘" class="sheet-title-icon">
                            `;
                            reopenSheetBtn.textContent = `'${keyword}' 검색 결과 ${pagination.totalCount}개`;
                            displayPlaces(data);
                            displayPagination(pagination);
                            showResultsSheet();
                        } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
                            alert('검색 결과가 없습니다.');
                            removeAllChildNods(document.getElementById('results'));
                            removeMarker();
                        } else if (status === kakao.maps.services.Status.ERROR) {
                            alert('검색 중 오류가 발생했습니다.');
                            removeAllChildNods(document.getElementById('results'));
                            removeMarker();
                        }
                    }, searchOptions);
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

                function displayPlaces(places) {
                    removeAllChildNods(resultsContainer);
                    removeMarker();
                    customOverlay.setMap(null); 

                    for (let i = 0; i < places.length; i++) {
                        const place = places[i];
                        const marker = addMarker(new kakao.maps.LatLng(place.y, place.x));
                        const itemEl = getListItem(i, place);

                        const content = `<div class="infowindow-content">${place.place_name}</div>`;

                        const showOverlay = () => {
                            clearTimeout(hideOverlayTimeout);
                            customOverlay.setContent(content);
                            customOverlay.setPosition(marker.getPosition());
                            customOverlay.setMap(map);
                        };
                        const hideOverlay = () => {
                            hideOverlayTimeout = setTimeout(() => {
                                customOverlay.setMap(null);
                            }, 100);
                        };

                        kakao.maps.event.addListener(marker, 'mouseover', showOverlay);
                        kakao.maps.event.addListener(marker, 'mouseout', hideOverlay);
                        kakao.maps.event.addListener(marker, 'click', () => openPlacePopup(place.place_url));
                        
                        itemEl.addEventListener('mouseover', showOverlay);
                        itemEl.addEventListener('mouseout', hideOverlay);
                        itemEl.addEventListener('click', (e) => {
                            if (e.target.classList.contains('add-to-vote-btn')) {
                                e.stopPropagation();
                                return;
                            }
                            openPlacePopup(place.place_url)
                        });

                        itemEl.querySelector('.add-to-vote-btn').addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (voteList.some(item => item.id === place.id)) {
                                removeFromVoteList(place.id);
                            } else {
                                addToVoteList(place);
                            }
                        });

                        resultsContainer.appendChild(itemEl);
                    }
                    
                    if (places.length > 0) {
                        const firstPlace = places[0];
                        const moveLatLon = new kakao.maps.LatLng(firstPlace.y, firstPlace.x);
                        map.panTo(moveLatLon);
                    }
                }
                
                function getListItem(index, place) {
                    const el = document.createElement('div');
                    el.classList.add('item');
                    
                    const isAdded = voteList.some(item => item.id === place.id);

                    const address = place.road_address_name || place.address_name;
                    el.innerHTML = `
                        <div class="item-content">
                            <h5>${place.place_name}</h5>
                            <span>${address}</span>
                        </div>
                        <button 
                            class="add-to-vote-btn ${isAdded ? 'added' : ''}" 
                            title="${isAdded ? '목록에서 제거' : '투표 목록에 추가'}"
                            data-place-id="${place.id}"
                        >
                            ${isAdded ? '✓' : '+'}
                        </button>
                    `;
                    
                    return el;
                }

                function addMarker(position) {
                    const marker = new kakao.maps.Marker({
                        position: position
                    });

                    marker.setMap(map);
                    markers.push(marker);
                    return marker;
                }

                function removeMarker() {
                    for (let i = 0; i < markers.length; i++) {
                        markers[i].setMap(null);
                    }
                    markers = [];
                }
                
                function addToVoteList(place) {
                    if (voteList.some(item => item.id === place.id)) {
                        alert('이미 투표 목록에 추가된 맛집입니다.');
                        return;
                    }
                    voteList.push(place);
                    renderVoteList();
                    updateAddButtonState(place.id, true);
                    updateVoteGnbButton();
                }

                function removeFromVoteList(placeId) {
                    voteList = voteList.filter(item => item.id !== placeId);
                    renderVoteList();
                    updateAddButtonState(placeId, false);
                    updateVoteGnbButton();
                }

                function updateVoteGnbButton() {
                    if (voteList.length > 0) {
                        voteCountSpan.textContent = voteList.length;
                        showVoteListBtn.style.display = 'block';
                    } else {
                        showVoteListBtn.style.display = 'none';
                    }
                }

                function renderVoteList() {
                    voteListContainer.innerHTML = ''; 

                    if (voteList.length === 0) {
                        voteModalFooter.style.display = 'none'; 
                        voteListContainer.innerHTML = `
                            <div class="empty-vote-list">
                                <p>선택한 맛집이 없습니다.</p>
                                <button id="go-back-to-select-btn" class="light-text-btn">다시 맛집 선택하러 가기</button>
                            </div>
                        `;
                        document.getElementById('go-back-to-select-btn').addEventListener('click', hideVoteModal);
                        return;
                    }

                    voteModalFooter.style.display = 'block'; 
                    const list = document.createElement('ul');
                    list.className = 'vote-ul';

                    voteList.forEach((place) => {
                        const listItem = document.createElement('li');
                        listItem.className = 'vote-item';
                        listItem.innerHTML = `
                            <span class="place-name">${place.place_name}</span>
                            <button class="remove-vote-btn" data-place-id="${place.id}" title="삭제">&times;</button>
                        `;

                        listItem.querySelector('.remove-vote-btn').addEventListener('click', (e) => {
                            e.stopPropagation(); 
                            removeFromVoteList(place.id);
                        });

                        listItem.addEventListener('click', () => {
                            openPlacePopup(place.place_url);
                        });

                        list.appendChild(listItem);
                    });

                    voteListContainer.appendChild(list);
                }

                function updateAddButtonState(placeId, isAdded) {
                    const addButton = document.querySelector(`.add-to-vote-btn[data-place-id="${placeId}"]`);
                    if (addButton) {
                        addButton.textContent = isAdded ? '✓' : '+';
                        addButton.title = isAdded ? '목록에서 제거' : '투표 목록에 추가';
                        if (isAdded) {
                            addButton.classList.add('added');
                        } else {
                            addButton.classList.remove('added');
                        }
                    }
                }

                function openPlacePopup(placeUrl) {
                    const popupWidth = 400;
                    const popupHeight = 800;
                    const popupX = window.screen.width - popupWidth;
                    const popupY = (window.screen.height / 2) - (popupHeight / 2);
                    const popupFeatures = `width=${popupWidth},height=${popupHeight},left=${popupX},top=${popupY},scrollbars=yes,resizable=yes`;
                    window.open(placeUrl, 'place_details_popup', popupFeatures);
                }
                
                function removeAllChildNods(el) {
                    while (el.hasChildNodes()) {
                        el.removeChild(el.lastChild);
                    }
                }
                
                function displayPagination(pagination) {
                    const paginationEl = document.createElement('div');
                    paginationEl.classList.add('pagination');

                    for (let i = 1; i <= pagination.last; i++) {
                        let a = document.createElement('a');
                        a.href = "#";
                        a.innerHTML = i;
                        if (i === pagination.current) {
                            a.className = 'on';
                        }
                        a.onclick = (function(i) {
                            return function() {
                                pagination.gotoPage(i);
                            }
                        })(i);
                        paginationEl.appendChild(a);
                    }

                    resultsContainer.appendChild(paginationEl);
                }

                function showVoteModal() {
                    if (resultsSheet.classList.contains('visible')) {
                        resultsSheetWasOpen = true;
                        hideResultsSheet();
                        setTimeout(() => {
                            voteModal.style.display = 'flex';
                        }, 400); 
                    } else {
                        resultsSheetWasOpen = false;
                        voteModal.style.display = 'flex';
                    }
                }

                function hideVoteModal() {
                    voteModal.style.display = 'none';
                    if (resultsSheetWasOpen) {
                        showResultsSheet();
                    }
                }

                function createVoteLink() {
                    if (voteList.length === 0) {
                        alert('공유할 맛집을 먼저 선택해주세요.');
                        return;
                    }

                    const placesToShare = voteList.map(place => ({
                        id: place.id,
                        place_name: place.place_name,
                        address_name: place.address_name,
                        road_address_name: place.road_address_name,
                        place_url: place.place_url 
                    }));

                    const data = JSON.stringify(placesToShare);
                    const encodedData = btoa(encodeURIComponent(data));
                    
                    const url = `${window.location.origin}/vote.html?data=${encodedData}`;

                    navigator.clipboard.writeText(url).then(() => {
                        alert('투표 링크가 클립보드에 복사되었습니다!');
                    }).catch(err => {
                        console.error('클립보드 복사 실패: ', err);
                        alert('클립보드 복사에 실패했습니다. 수동으로 복사해주세요.');
                        prompt('아래 링크를 복사하여 친구들에게 공유하세요!', url); 
                    });
                }
            });
        };
    }

    loadMapSDK();
});