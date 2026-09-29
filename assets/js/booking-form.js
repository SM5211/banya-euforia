/* ==========================================================================
   Форма заявки на бронь: валидация + отправка.

   КУДА УХОДЯТ ЗАЯВКИ
   Гость нажимает «Оставить заявку» — она уходит в Google-таблицу
   «Эйфория — заявки с сайта» и там же появляется строкой со статусом «Новая».
   Ни Instagram, ни WhatsApp в этом не участвуют: гостю не нужно ничего
   копировать и никуда переходить.

   Адрес приёмника задан в разметке, атрибутом тега <form>:
       <form data-booking-form data-endpoint="https://script.google.com/…/exec">
   Сам приёмник — скрипт внутри таблицы (Расширения → Apps Script),
   его исходник лежит в соседней папке banya-euforia-заявки.

   ЕСЛИ ТАБЛИЦА НЕДОСТУПНА (нет сети, скрипт сломан, Google молчит дольше
   20 секунд) — заявку не теряем: текст показывается прямо на странице
   и копируется в буфер, а гостя просим позвонить.
   ========================================================================== */

(function (EUF) {
  'use strict';

  EUF.initBookingForm = function () {
    var form = document.querySelector('[data-booking-form]');
    if (!form) return;

    var status = form.querySelector('[data-form-status]');
    var submitBtn = form.querySelector('[type="submit"]');
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
    /* Плашка живёт на уровне страницы, а не внутри формы: у формы бывает
       анимация появления с transform, и она обрезала бы окно по своей ширине */
    var menuModal = document.querySelector('[data-menu-modal]');

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
      return Array.prototype.slice.call(document.querySelectorAll('[data-dish]'))
        .map(function (row) {
          var qty = Number(row.querySelector('.stepper__value').value) || 0;
          var price = Number(row.dataset.price) || 0;
          return { name: row.dataset.name, portion: row.dataset.portion, price: price, qty: qty, sum: qty * price };
        })
        .filter(function (d) { return d.qty > 0; });
    }

    function updatePreorder() {
      var picked = pickedDishes();

      document.querySelectorAll('[data-dish]').forEach(function (row) {
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
      var sum = document.querySelector('[data-menu-sum]');
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
        var first = form.querySelector('.field.has-error input, .field.has-error select, .field.has-error textarea');
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

    /* --- Отправка в таблицу ---------------------------------------------- */

    /* Собирает заявку в поля таблицы. FormData здесь не годится: плашка
       с меню живёт вне <form>, и выбранные блюда в неё не попадают. */
    function sheetPayload(source) {
      var get = function (name) {
        var el = form.querySelector('[name="' + name + '"]');
        return el ? el.value.trim() : '';
      };
      var date = get('date');
      if (date) {
        var p = date.split('-');
        date = p[2] + '.' + p[1] + '.' + p[0];
      }
      var dishes = pickedDishes();
      return {
        name: get('name'),
        phone: get('phone'),
        date: date,
        time: get('time'),
        guests: get('guests'),
        comment: get('comment'),
        dishes: dishes.map(function (d) {
          return d.name + ' (' + d.portion + ') × ' + d.qty;
        }).join('; '),
        total: dishes.reduce(function (n, d) { return n + d.sum; }, 0),
        source: source
      };
    }

    /* Content-Type намеренно text/plain: с application/json браузер сначала
       шлёт проверочный OPTIONS-запрос, а веб-приложение Google на него
       не отвечает, и отправка падает. Тело при этом обычный JSON. */
    function sendToSheet(source) {
      var endpoint = form.dataset.endpoint;
      if (!endpoint) return Promise.reject(new Error('endpoint не задан'));

      /* Google выполняет обращения к скрипту по очереди: если две заявки
         придут почти одновременно, вторая ждёт первую. Обычно это 1–3 секунды,
         но в худшем случае бывает и двадцать. Держать гостя на «Отправляем…»
         бесконечно нельзя — через 20 секунд сдаёмся и предлагаем Instagram. */
      var stop = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { if (stop) stop.abort(); }, 20000);

      return fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(sheetPayload(source)),
        signal: stop ? stop.signal : undefined
      }).then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('таблица ответила ' + res.status);
        return res;
      }, function (err) {
        clearTimeout(timer);
        throw err;
      });
    }

    /* После успешной отправки счётчики порций надо обнулить руками:
       form.reset() до них не дотянется, плашка меню лежит вне формы */
    function resetDishes() {
      document.querySelectorAll('[data-dish] .stepper__value').forEach(function (i) {
        i.value = 0;
      });
      updatePreorder();
    }

    /* --- Отправка -------------------------------------------------------- */
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!isValid()) return;

      submitBtn.disabled = true;
      setStatus('Отправляем заявку…', 'pending');

      sendToSheet('сайт').then(function () {
        form.reset();
        resetDishes();
        submitBtn.disabled = false;
        if (EUF.goal) EUF.goal('booking_sent');
        setStatus('Заявка принята! Перезвоним, чтобы подтвердить время.', 'success');
      }).catch(function (err) {
        /* Заявку нельзя терять. Показываем её текст прямо на странице
           и копируем в буфер: гость сможет продиктовать или переслать
           её по телефону, а не уйдёт ни с чем. */
        console.error(err);
        submitBtn.disabled = false;
        var text = buildText();
        var copied = copySync(text);
        if (!copied) copyToClipboard(text).catch(function () {});
        showCopyBox(text, copied
          ? 'Заявка скопирована — продиктуйте её по телефону'
          : 'Заявка не ушла — скопируйте текст и позвоните нам');
        setStatus('Не получилось отправить заявку. Позвоните: 58-25-25 — примем бронь сразу.', 'error');
      });
    });

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
