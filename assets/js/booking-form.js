/* ==========================================================================
   Форма заявки на бронь: валидация + отправка.

   КУДА УХОДЯТ ЗАЯВКИ
   По умолчанию — в Instagram Direct комплекса (@banya_euforia_).
   Важно понимать ограничение самого Instagram: он НЕ умеет принимать текст
   по ссылке, предзаполнить сообщение нельзя. Поэтому кнопка делает так:
     1) собирает заявку в аккуратный текст;
     2) копирует его в буфер обмена гостя;
     3) открывает чат Instagram — гостю остаётся вставить и отправить.
   Если буфер недоступен (старый браузер, отказ в правах), текст показывается
   прямо на странице, чтобы его можно было скопировать руками.

   Кнопка «Отправить в WhatsApp» рядом работает без этих плясок: WhatsApp
   подставляет весь текст сам.

   ЕСЛИ ЗАХОТИТЕ ПОЛНОЦЕННУЮ ОТПРАВКУ (заявка приходит сама, без участия гостя):
   заведите форму на formspree.io или свой обработчик для Telegram-бота
   и допишите тегу <form> в contact/index.html адрес:
       <form data-booking-form data-endpoint="https://formspree.io/f/ВАШ_ID" ...>
   Тогда код ниже отправит заявку туда, а Instagram открывать не станет.
   ========================================================================== */

(function (EUF) {
  'use strict';

  var INSTAGRAM_DM = 'https://ig.me/m/banya_euforia_';
  var WHATSAPP_PHONE = '79643582525';   // WhatsApp комплекса

  EUF.initBookingForm = function () {
    var form = document.querySelector('[data-booking-form]');
    if (!form) return;

    var status = form.querySelector('[data-form-status]');
    var submitBtn = form.querySelector('[type="submit"]');
    var waBtn = form.querySelector('[data-send-whatsapp]');
    var copyBox = form.querySelector('[data-copy-box]');

    /* Дату в прошлом выбрать нельзя */
    var dateField = form.querySelector('input[type="date"]');
    if (dateField && !dateField.min) {
      dateField.min = new Date().toISOString().slice(0, 10);
    }

    /* Простая маска телефона: +7 (924) 532-34-74 */
    var phone = form.querySelector('input[type="tel"]');
    if (phone) {
      phone.addEventListener('input', function () {
        var digits = phone.value.replace(/\D/g, '').replace(/^8/, '7').replace(/^([^7])/, '7$1').slice(0, 11);
        var out = '+7';
        if (digits.length > 1) out += ' (' + digits.slice(1, 4);
        if (digits.length >= 5) out += ') ' + digits.slice(4, 7);
        if (digits.length >= 8) out += '-' + digits.slice(7, 9);
        if (digits.length >= 10) out += '-' + digits.slice(9, 11);
        phone.value = out;
      });
    }

    /* --- Предзаказ из кухни: плашка со всем меню -------------------------- */
    var menuModal = form.querySelector('[data-menu-modal]');

    if (menuModal) {
      /* счётчики порций */
      menuModal.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-plus], [data-minus]');
        if (btn) {
          var input = btn.closest('[data-dish]').querySelector('.stepper__value');
          setQty(input, (Number(input.value) || 0) + (btn.hasAttribute('data-plus') ? 1 : -1));
          return;
        }
        if (e.target.closest('[data-menu-close], [data-menu-done]')) { closeMenu(); return; }
        var tab = e.target.closest('[data-jump]');
        if (tab) {
          var target = menuModal.querySelector('#' + tab.dataset.jump);
          var body = menuModal.querySelector('[data-menu-scroll]');
          if (target && body) {
            /* считаем позицию относительно самой прокручиваемой области:
               offsetTop здесь врёт, потому что карточка позиционирована */
            /* offsetTop у обоих считается от карточки, поэтому разница —
               это честное смещение раздела внутри прокручиваемой области.
               Через getBoundingClientRect цифра плывёт из-за липких заголовков. */
            var top = target.offsetTop - body.offsetTop;
            /* прыжок мгновенный: плавная прокрутка внутри плашки
               в части браузеров просто не срабатывает */
            body.scrollTop = Math.max(0, top - 6);
          }
          menuModal.querySelectorAll('.menu-modal__tab').forEach(function (t) {
            t.classList.toggle('is-active', t === tab);
          });
        }
      });

      menuModal.addEventListener('input', function (e) {
        if (e.target.classList.contains('stepper__value')) setQty(e.target, Number(e.target.value) || 0);
      });

      form.querySelectorAll('[data-preorder-open]').forEach(function (btn) {
        btn.addEventListener('click', openMenu);
      });

      updatePreorder();
    }

    function openMenu() {
      menuModal.hidden = false;
      document.body.classList.add('is-locked');
      if (EUF.lenis) EUF.lenis.stop();
      document.addEventListener('keydown', onMenuKey);
      menuModal.querySelector('.menu-modal__close').focus();
    }

    function closeMenu() {
      menuModal.hidden = true;
      document.body.classList.remove('is-locked');
      if (EUF.lenis) EUF.lenis.start();
      document.removeEventListener('keydown', onMenuKey);
      var opener = form.querySelector('[data-preorder-open]');
      if (opener) opener.focus();
    }

    function onMenuKey(e) { if (e.key === 'Escape') closeMenu(); }

    function setQty(input, value) {
      var max = Number(input.max) || 20;
      input.value = Math.max(0, Math.min(max, value));
      updatePreorder();
    }

    /* Собирает выбранные блюда: [{название, порция, цена, количество, сумма}] */
    function pickedDishes() {
      return Array.prototype.slice.call(form.querySelectorAll('[data-dish]'))
        .map(function (row) {
          var qty = Number(row.querySelector('.stepper__value').value) || 0;
          var price = Number(row.dataset.price) || 0;
          return { name: row.dataset.name, portion: row.dataset.portion, price: price, qty: qty, sum: qty * price };
        })
        .filter(function (d) { return d.qty > 0; });
    }

    function updatePreorder() {
      var picked = pickedDishes();

      form.querySelectorAll('[data-dish]').forEach(function (row) {
        var qty = Number(row.querySelector('.stepper__value').value) || 0;
        row.classList.toggle('is-picked', qty > 0);
        row.querySelector('[data-minus]').disabled = qty === 0;
      });

      var count = picked.reduce(function (n, d) { return n + d.qty; }, 0);
      var total = picked.reduce(function (n, d) { return n + d.sum; }, 0);
      var money = total.toLocaleString('ru-RU') + ' ₽';
      var label = count + ' ' + plural(count, ['позиция', 'позиции', 'позиций']);

      /* строка под кнопкой в форме */
      var summary = form.querySelector('[data-preorder-summary]');
      if (summary) {
        summary.hidden = !picked.length;
        if (picked.length) {
          summary.querySelector('[data-preorder-count]').textContent = label;
          summary.querySelector('[data-preorder-total]').textContent = money;
        }
      }

      /* подпись на кнопке открытия */
      var brief = form.querySelector('[data-preorder-brief]');
      if (brief) {
        brief.textContent = picked.length
          ? 'Выбрано: ' + label + ' на ' + money
          : 'Закуски, горячее, напитки — 50 позиций';
      }

      /* итог внизу плашки */
      var sum = form.querySelector('[data-menu-sum]');
      if (sum) {
        sum.innerHTML = picked.length
          ? 'Выбрано <b>' + label + '</b> · на сумму <b>' + money + '</b>'
          : 'Ничего не выбрано';
      }
    }

    function plural(n, forms) {
      var n10 = n % 10, n100 = n % 100;
      if (n10 === 1 && n100 !== 11) return forms[0];
      if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
      return forms[2];
    }

    /* --- Валидация ------------------------------------------------------- */
    function validateField(field) {
      var wrap = field.closest('.field');
      var errorEl = wrap ? wrap.querySelector('.field__error') : null;
      var message = '';

      if (field.hasAttribute('required') && !field.value.trim()) {
        message = 'Заполните это поле';
      } else if (field.type === 'tel' && field.value.replace(/\D/g, '').length < 11) {
        message = 'Телефон нужен полностью, 11 цифр';
      } else if (field.type === 'number' && field.value) {
        var n = Number(field.value);
        if (n < Number(field.min || 1)) message = 'Минимум ' + (field.min || 1);
        if (n > Number(field.max || 15)) message = 'Максимум ' + (field.max || 15) + ' человек';
      } else if (!field.checkValidity()) {
        message = 'Проверьте формат';
      }

      if (wrap) wrap.classList.toggle('has-error', !!message);
      if (errorEl) errorEl.textContent = message;
      field.setAttribute('aria-invalid', message ? 'true' : 'false');
      return !message;
    }

    var fields = Array.prototype.slice.call(form.querySelectorAll('input, textarea, select'));
    fields.forEach(function (field) {
      field.addEventListener('blur', function () { validateField(field); });
      field.addEventListener('input', function () {
        var wrap = field.closest('.field');
        if (wrap && wrap.classList.contains('has-error')) validateField(field);
      });
    });

    function isValid() {
      var ok = true;
      fields.forEach(function (field) { if (!validateField(field)) ok = false; });
      if (!ok) {
        setStatus('Проверьте отмеченные поля — что-то заполнено не до конца.', 'error');
        var first = form.querySelector('.field.has-error input, .field.has-error textarea');
        if (first) first.focus();
      }
      return ok;
    }

    /* --- Текст заявки ---------------------------------------------------- */
    function buildText() {
      var get = function (name) {
        var el = form.querySelector('[name="' + name + '"]');
        return el ? el.value.trim() : '';
      };
      var date = get('date');
      if (date) {
        var parts = date.split('-');
        date = parts[2] + '.' + parts[1] + '.' + parts[0];
      }
      var lines = [
        'Здравствуйте! Хочу забронировать баню.',
        '',
        'Имя: ' + get('name'),
        'Телефон: ' + get('phone'),
        'Дата: ' + date,
        'Время: ' + get('time'),
        'Гостей: ' + get('guests')
      ];
      /* Предзаказ из кухни — с количеством порций и суммой */
      var dishes = pickedDishes();
      if (dishes.length) {
        lines.push('');
        lines.push('Предзаказ из кухни:');
        dishes.forEach(function (d) {
          lines.push('• ' + d.name + ' (' + d.portion + ') × ' + d.qty + ' — ' + d.sum.toLocaleString('ru-RU') + ' ₽');
        });
        var total = dishes.reduce(function (n, d) { return n + d.sum; }, 0);
        lines.push('Итого по кухне: ' + total.toLocaleString('ru-RU') + ' ₽');
      }

      var comment = get('comment');
      if (comment) {
        lines.push('');
        lines.push('Комментарий: ' + comment);
      }
      return lines.join('\n');
    }

    /* --- Отправка -------------------------------------------------------- */
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!isValid()) return;

      var text = buildText();
      var endpoint = form.dataset.endpoint;

      /* Если подключён бэкенд — отправляем туда и Instagram не трогаем */
      if (endpoint) {
        var data = {};
        new FormData(form).forEach(function (value, key) { data[key] = value; });
        submitBtn.disabled = true;
        setStatus('Отправляем заявку…', 'pending');
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(data)
        }).then(function (res) {
          if (!res.ok) throw new Error('bad status ' + res.status);
          form.reset();
          submitBtn.disabled = false;
          if (EUF.goal) EUF.goal('booking_sent');
          setStatus('Заявка принята! Перезвоним, чтобы подтвердить время.', 'success');
        }).catch(function (err) {
          console.error(err);
          submitBtn.disabled = false;
          setStatus('Не получилось отправить. Позвоните нам: 58-25-25', 'error');
        });
        return;
      }

      /* ВАЖЕН ПОРЯДОК. Сначала копируем — синхронно, пока страница ещё в фокусе.
         Если сперва открыть чат, браузер уводит фокус на Instagram и запрещает
         запись в буфер обмена — текст не скопируется. */
      var copied = copySync(text);
      if (!copied) copyToClipboard(text).catch(function () {});

      EUF.goal && EUF.goal('booking_sent');

      /* Чат Instagram открываем не сразу, а по кнопке в плашке: гость должен
         увидеть, что текст скопирован и его нужно вставить. Клик по кнопке
         в плашке — тоже жест пользователя, поэтому окно не блокируется. */
      showCopyModal(text, copied);
      setStatus(copied
        ? 'Текст заявки скопирован — вставьте его в чат Instagram.'
        : 'Скопируйте текст заявки и отправьте его в Instagram.', copied ? 'success' : 'pending');
    });

    /* --- Плашка перед переходом в Instagram ------------------------------- */
    function showCopyModal(text, copied) {
      var modal = document.querySelector('[data-copy-modal]');
      if (!modal) {   /* плашки на странице нет — ведём себя как раньше */
        window.open(INSTAGRAM_DM, '_blank', 'noopener');
        return;
      }

      modal.querySelector('[data-modal-preview]').textContent = text;
      modal.classList.toggle('is-manual', !copied);
      modal.querySelector('[data-modal-badge]').textContent = copied
        ? 'Текст заявки скопирован'
        : 'Скопируйте текст заявки';
      modal.querySelector('[data-modal-text]').textContent = copied
        ? 'Instagram не умеет подставлять текст сам. Откройте чат, задержите палец на поле ввода, выберите «Вставить» — и отправьте сообщение.'
        : 'Браузер не дал скопировать автоматически. Выделите текст ниже, скопируйте его и вставьте в чат Instagram.';

      modal.hidden = false;
      document.body.classList.add('is-locked');
      if (EUF.lenis) EUF.lenis.stop();
      modal.querySelector('[data-modal-go]').focus();

      /* Esc и клик по фону закрывают плашку */
      document.addEventListener('keydown', onKey);
      modal.addEventListener('click', onClick);

      function onKey(e) { if (e.key === 'Escape') close(); }
      function onClick(e) {
        if (e.target.closest('[data-modal-close]')) { close(); return; }
        if (e.target.closest('[data-modal-copy]')) {
          var ok = copySync(text);
          var badge = modal.querySelector('[data-modal-badge]');
          badge.textContent = ok ? 'Текст скопирован ещё раз' : 'Скопируйте текст вручную';
          modal.classList.toggle('is-manual', !ok);
          return;
        }
        if (e.target.closest('[data-modal-go]')) {
          /* ссылка откроется сама, плашку просто закрываем */
          setTimeout(close, 100);
        }
      }
      function close() {
        modal.hidden = true;
        document.body.classList.remove('is-locked');
        if (EUF.lenis) EUF.lenis.start();
        document.removeEventListener('keydown', onKey);
        modal.removeEventListener('click', onClick);
      }
    }

    /* Кнопка WhatsApp: там текст подставляется сам, копировать ничего не надо */
    if (waBtn) {
      waBtn.addEventListener('click', function () {
        if (!isValid()) return;
        if (EUF.goal) EUF.goal('booking_sent');
        window.open('https://wa.me/' + WHATSAPP_PHONE + '?text=' + encodeURIComponent(buildText()), '_blank', 'noopener');
        setStatus('Открыли WhatsApp — текст заявки уже подставлен, осталось отправить.', 'success');
      });
    }

    /* Синхронное копирование — работает внутри клика и не зависит от того,
       успел ли браузер увести фокус в другое приложение.
       execCommand устарел, но остаётся единственным синхронным способом,
       и поддерживается всеми актуальными браузерами. */
    function copySync(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
      document.body.appendChild(ta);
      var ok = false;
      try {
        if (/ipad|iphone|ipod/i.test(navigator.userAgent)) {
          /* на iOS нужен именно диапазон выделения, ta.select() не срабатывает */
          var range = document.createRange();
          range.selectNodeContents(ta);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          ta.setSelectionRange(0, text.length);
        } else {
          ta.select();
        }
        ok = document.execCommand('copy');
      } catch (e) {
        ok = false;
      }
      document.body.removeChild(ta);
      return ok;
    }

    function copyToClipboard(text) {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
      }
      /* запасной путь для http и старых браузеров */
      return new Promise(function (resolve, reject) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('clipboard unavailable'));
      });
    }

    function showCopyBox(text, title) {
      if (!copyBox) return;
      copyBox.hidden = false;
      copyBox.querySelector('[data-copy-title]').textContent = title;
      var area = copyBox.querySelector('textarea');
      area.value = text;
      area.focus();
      area.select();
    }

    function setStatus(text, kind) {
      if (!status) return;
      status.textContent = text;
      status.className = 'form-status is-' + kind;
    }
  };
})(window.EUF);
